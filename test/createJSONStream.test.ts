import { describe, expect, it } from "vitest";
import { createJSONStream } from "../src/index";

describe("createJSONStream", () => {
  it("accumulates chunks and returns the current best-effort parse", () => {
    const stream = createJSONStream();
    expect(stream.feed("")).toBeUndefined();
    expect(stream.feed('{"ti')).toEqual({});
    expect(stream.feed('tle": "Pad')).toEqual({ title: "Pad" });
    expect(stream.feed(' Thai", "ser')).toEqual({ title: "Pad Thai" });
    expect(stream.feed('vings": 4')).toEqual({ title: "Pad Thai", servings: 4 });
    expect(stream.feed("}")).toEqual({ title: "Pad Thai", servings: 4 });
  });

  it("exposes the raw accumulated buffer untouched", () => {
    const stream = createJSONStream();
    stream.feed('{"a": ');
    stream.feed("[1, 2");
    expect(stream.raw).toBe('{"a": [1, 2');
    stream.feed("]}");
    expect(stream.raw).toBe('{"a": [1, 2]}');
  });

  it("raw is read-only", () => {
    const stream = createJSONStream();
    stream.feed("[1");
    expect(() => {
      // @ts-expect-error — raw is a readonly getter
      stream.raw = "hacked";
    }).toThrow();
    expect(stream.raw).toBe("[1");
  });

  it("independent streams do not share state", () => {
    const a = createJSONStream();
    const b = createJSONStream();
    a.feed('{"a": 1');
    b.feed('["b"');
    expect(a.feed("}")).toEqual({ a: 1 });
    expect(b.feed("]")).toEqual(["b"]);
  });

  it("never throws on any chunking of a valid document", () => {
    const doc = '{"list": [1, 2.5, -3e2, true, null, "x\\"y"], "obj": {"k": "v"}}';
    for (let size = 1; size <= 7; size++) {
      const stream = createJSONStream();
      let last: unknown;
      for (let i = 0; i < doc.length; i += size) {
        expect(() => {
          last = stream.feed(doc.slice(i, i + size));
        }).not.toThrow();
      }
      expect(last).toEqual(JSON.parse(doc));
      expect(stream.raw).toBe(doc);
    }
  });
});
