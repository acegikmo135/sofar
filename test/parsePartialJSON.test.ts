import { describe, expect, it } from "vitest";
import { parsePartialJSON } from "../src/index";

describe("parsePartialJSON — strings", () => {
  it("string cut mid-word", () => {
    expect(parsePartialJSON('{"title": "Hello wor')).toEqual({
      title: "Hello wor",
    });
  });

  it("string cut right after an unescaped trailing backslash", () => {
    // The dangling `\` is dropped rather than left to break the parse.
    expect(parsePartialJSON('{"path": "C:\\')).toEqual({ path: "C:" });
  });

  it("string ending in an escaped backslash is kept intact", () => {
    // `\\` is a complete escape — the string legitimately ends in a backslash.
    expect(parsePartialJSON('{"path": "C:\\\\')).toEqual({ path: "C:\\" });
  });

  it("escaped quote inside an open string does not close it", () => {
    expect(parsePartialJSON('{"q": "say \\"hi')).toEqual({ q: 'say "hi' });
  });

  it("unicode escape cut mid-sequence (\\u00e)", () => {
    expect(parsePartialJSON('{"s": "caf\\u00e')).toEqual({ s: "caf" });
    expect(parsePartialJSON('{"s": "caf\\u')).toEqual({ s: "caf" });
    expect(parsePartialJSON('{"s": "caf\\')).toEqual({ s: "caf" });
  });

  it("complete unicode escape parses normally", () => {
    expect(parsePartialJSON('{"s": "caf\\u00e9')).toEqual({ s: "café" });
  });

  it("brackets and commas inside strings are not structural", () => {
    expect(parsePartialJSON('{"s": "a, b] } {"')).toEqual({ s: "a, b] } {" });
    expect(parsePartialJSON('{"s": "a, b] } {')).toEqual({ s: "a, b] } {" });
  });
});

describe("parsePartialJSON — containers", () => {
  it("nested objects/arrays cut at various depths", () => {
    const doc = '{"a": [1, {"b": [2, {"c": "deep"}]}], "d": true}';
    expect(parsePartialJSON('{"a": [1, {"b": [2, {"c": "de')).toEqual({
      a: [1, { b: [2, { c: "de" }] }],
    });
    expect(parsePartialJSON('{"a": [1, {"b": [2, {')).toEqual({
      a: [1, { b: [2, {}] }],
    });
    expect(parsePartialJSON('{"a": [1, {"b": [2')).toEqual({
      a: [1, { b: [2] }],
    });
    expect(parsePartialJSON('{"a": [1, {"b"')).toEqual({ a: [1, {}] });
    expect(parsePartialJSON('{"a": [1, {')).toEqual({ a: [1, {}] });
    expect(parsePartialJSON('{"a": [')).toEqual({ a: [] });
    expect(parsePartialJSON("{")).toEqual({});
    expect(parsePartialJSON(doc)).toEqual(JSON.parse(doc));
  });

  it("object key with no colon or value yet", () => {
    expect(parsePartialJSON('{"title": "x", "ingr')).toEqual({ title: "x" });
    expect(parsePartialJSON('{"title": "x", "ingredients"')).toEqual({
      title: "x",
    });
    expect(parsePartialJSON('{"title": "x", "ingredients":')).toEqual({
      title: "x",
    });
    expect(parsePartialJSON('{"title": "x", "ingredients": ')).toEqual({
      title: "x",
    });
    expect(parsePartialJSON('{"ingr')).toEqual({});
    expect(parsePartialJSON('{"ingredients":')).toEqual({});
  });

  it("trailing comma from a truncated buffer", () => {
    expect(parsePartialJSON('{"a": 1,')).toEqual({ a: 1 });
    expect(parsePartialJSON('{"a": 1, ')).toEqual({ a: 1 });
    expect(parsePartialJSON("[1, 2,")).toEqual([1, 2]);
    expect(parsePartialJSON('[{"a": 1},')).toEqual([{ a: 1 }]);
  });

  it("deeply nested (20+ levels) structures", () => {
    const depth = 25;
    // Alternating [ and {"k": openers, 25 deep, with a leaf at the bottom.
    let open = "";
    for (let i = 0; i < depth; i++) open += i % 2 === 0 ? "[" : '{"k":';
    const parsed = parsePartialJSON(open + "1");

    // Walk down and confirm the leaf survived at the right depth.
    let node: unknown = parsed;
    for (let i = 0; i < depth; i++) {
      if (i % 2 === 0) {
        expect(Array.isArray(node)).toBe(true);
        node = (node as unknown[])[0];
      } else {
        expect(typeof node).toBe("object");
        node = (node as Record<string, unknown>)["k"];
      }
    }
    expect(node).toBe(1);

    // Cut in the middle of the opener run: every open container gets closed.
    for (const cut of [3, 11, 30, 60, open.length]) {
      const partial = parsePartialJSON(open.slice(0, cut));
      expect(partial).toBeDefined();
      expect(() => JSON.stringify(partial)).not.toThrow();
    }
  });
});

describe("parsePartialJSON — literals and numbers", () => {
  it("partial literals: tru, fals, nul", () => {
    expect(parsePartialJSON('{"ok": tru')).toEqual({});
    expect(parsePartialJSON('{"ok": fals')).toEqual({});
    expect(parsePartialJSON('{"ok": nul')).toEqual({});
    expect(parsePartialJSON('{"a": 1, "ok": t')).toEqual({ a: 1 });
    expect(parsePartialJSON("[true, fals")).toEqual([true]);
    expect(parsePartialJSON("tru")).toBeUndefined();
  });

  it("complete literals", () => {
    expect(parsePartialJSON('{"ok": true')).toEqual({ ok: true });
    expect(parsePartialJSON("null")).toBeNull();
    expect(parsePartialJSON("false")).toBe(false);
  });

  it("numbers cut mid-digit, mid-exponent, or after a bare minus", () => {
    // A number cut mid-digit is still a valid (shorter) number.
    expect(parsePartialJSON('{"count": 42')).toEqual({ count: 42 });
    // `4.` is not valid JSON — fall back to the last known-good value.
    expect(parsePartialJSON('{"count": 4.')).toEqual({});
    expect(parsePartialJSON('{"a": 1, "count": 4.')).toEqual({ a: 1 });
    expect(parsePartialJSON('{"n": 1e')).toEqual({});
    expect(parsePartialJSON('{"n": 1e+')).toEqual({});
    expect(parsePartialJSON('{"n": 1E-')).toEqual({});
    expect(parsePartialJSON('{"n": -')).toEqual({});
    expect(parsePartialJSON("[1, 2, -")).toEqual([1, 2]);
    expect(parsePartialJSON("-")).toBeUndefined();
    expect(parsePartialJSON("1e")).toBeUndefined();
    expect(parsePartialJSON("1e+")).toBeUndefined();
    expect(parsePartialJSON("4.")).toBeUndefined();
  });
});

describe("parsePartialJSON — whole-document behaviour", () => {
  it("empty string / whitespace-only input returns undefined, not an exception", () => {
    expect(parsePartialJSON("")).toBeUndefined();
    expect(parsePartialJSON("   ")).toBeUndefined();
    expect(parsePartialJSON("\n\t ")).toBeUndefined();
  });

  it("complete valid JSON document parses identically to JSON.parse", () => {
    const docs = [
      '{"a": 1, "b": [true, false, null], "c": {"d": "e\\"f", "g": -1.5e10}}',
      "[]",
      "{}",
      '""',
      '"just a string"',
      "12345",
      "-0.5",
      "true",
      "null",
      '  {"padded": true}  \n',
      '{"unicode": "\\u00e9\\ud83d\\ude00", "raw": "é😀"}',
      '{"nested": {"empty": {}, "arr": [[], [[]]]}}',
    ];
    for (const doc of docs) {
      expect(parsePartialJSON(doc)).toEqual(JSON.parse(doc));
    }
  });

  it("does not throw on garbage input", () => {
    const junk = ["}", "]", "}}}}", "{]", ",,,", '"\\x', "\\", "{,", "[,]", "{{{]]]"];
    for (const bad of junk) {
      expect(() => parsePartialJSON(bad)).not.toThrow();
    }
  });

  it("top-level scalars in progress", () => {
    expect(parsePartialJSON('"hel')).toBe("hel");
    expect(parsePartialJSON("12")).toBe(12);
  });
});

describe("parsePartialJSON — fuzz", () => {
  const document = JSON.stringify({
    title: 'Pad Thai "authentic" \\ recipe',
    servings: 4,
    rating: -3.75e-2,
    vegan: false,
    notes: null,
    tags: ["noodles", "thai", "quick"],
    unicode: "café ☕ 😀 \u0000",
    steps: [
      { n: 1, text: "Soak noodles, [30 min]" },
      { n: 2, text: "Stir-fry {everything}, then serve" },
    ],
    nested: { a: { b: { c: { d: { e: [1, [2, [3, [4, [5]]]]] } } } } },
    empties: { obj: {}, arr: [], str: "" },
  });

  it("every intermediate prefix parses or returns undefined, never throws", () => {
    let successes = 0;
    for (let i = 0; i <= document.length; i++) {
      const prefix = document.slice(0, i);
      let value: unknown;
      expect(() => {
        value = parsePartialJSON(prefix);
      }).not.toThrow();
      if (value !== undefined) {
        successes++;
        // Every returned value must be real JSON.
        expect(() => JSON.stringify(value)).not.toThrow();
      }
    }
    // Sanity: the vast majority of prefixes should resolve to something.
    expect(successes).toBeGreaterThan(document.length * 0.9);
    // And the full document must round-trip exactly.
    expect(parsePartialJSON(document)).toEqual(JSON.parse(document));
  });

  it("never invents keys that are not in the final document", () => {
    const final = JSON.parse(document) as Record<string, unknown>;
    for (let i = 0; i <= document.length; i++) {
      const value = parsePartialJSON(document.slice(0, i));
      if (value === undefined) continue;
      for (const key of Object.keys(value as object)) {
        expect(key in final).toBe(true);
      }
    }
  });

  it("random chunk boundaries yield the same final value", () => {
    let seed = 42;
    const rand = () =>
      (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let trial = 0; trial < 50; trial++) {
      let buf = "";
      let pos = 0;
      let last: unknown;
      while (pos < document.length) {
        const step = 1 + Math.floor(rand() * 12);
        buf += document.slice(pos, pos + step);
        pos += step;
        expect(() => {
          last = parsePartialJSON(buf);
        }).not.toThrow();
      }
      expect(last).toEqual(JSON.parse(document));
    }
  });
});
