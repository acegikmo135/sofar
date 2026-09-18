/**
 * A stateful accumulator returned by {@link createJSONStream}.
 */
export interface JSONStream {
  /**
   * Append a chunk to the internal buffer and return the best-effort parse of
   * everything received so far. Returns `undefined` while nothing is
   * parseable yet. Never throws.
   */
  feed(chunk: string): unknown;
  /** Everything fed so far, concatenated and untouched. */
  readonly raw: string;
}

// ASCII code points used by the scanner.
const QUOTE = 34; // "
const BACKSLASH = 92; // \
const COMMA = 44; // ,
const LBRACE = 123; // {
const RBRACE = 125; // }
const LBRACKET = 91; // [
const RBRACKET = 93; // ]
const LOWER_U = 117; // u

function isHex(c: number): boolean {
  return (
    (c >= 48 && c <= 57) || // 0-9
    (c >= 65 && c <= 70) || // A-F
    (c >= 97 && c <= 102) // a-f
  );
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/**
 * Best-effort parse of a possibly-incomplete JSON string.
 *
 * Designed for JSON that is still arriving token-by-token from an LLM. The
 * input is scanned exactly once (O(n), no backtracking rescans); the scanner
 * records "safe cut points" as it goes, each with a snapshot of the open
 * container stack, so repairing a broken tail is O(1) per attempt.
 *
 * Repair strategy, in order:
 * 1. Drop a dangling `\` or partial `\uXXXX` escape at the end of an open
 *    string, close that string, then close every open `{` / `[`.
 * 2. If that still fails to parse, walk the cut points backwards — right
 *    after a string closes, right after a container opens or closes, and
 *    right before a structural comma — slicing the buffer there and closing
 *    the containers that were open at that point. The first slice that
 *    parses wins. This is what turns a dangling key (`{"a":"x","b`), a
 *    trailing comma, or a partial literal (`"ok": tru`) into the last
 *    known-good value instead of an error.
 *
 * @param input - Any prefix of a JSON document, including the whole thing.
 * @returns The parsed value, or `undefined` if nothing is parseable yet.
 *   Note that a complete `null` literal parses to `null`, not `undefined`.
 *   Never throws.
 *
 * @example
 * ```ts
 * parsePartialJSON('{"title": "Hel');        // { title: "Hel" }
 * parsePartialJSON('{"title": "Hi", "ta');   // { title: "Hi" }
 * parsePartialJSON('[1, 2, 3');              // [1, 2, 3]
 * parsePartialJSON('{"ok": tru');            // {}
 * parsePartialJSON('');                      // undefined
 * ```
 */
export function parsePartialJSON(input: string): unknown {
  const len = input.length;

  // `closers` is the container stack stored as the string of closing brackets
  // to append, innermost first. Prepend on open, drop the first char on
  // close. Snapshotting it is a single reference copy.
  let closers = "";
  let inString = false;
  let escape = false;
  // Tracks a `\uXXXX` escape in progress so a cut mid-sequence can be dropped.
  let uAt = -1;
  let uNeed = 0;

  // Parallel arrays: cut index + stack snapshot at that point.
  const cutAt: number[] = [];
  const cutClosers: string[] = [];

  for (let i = 0; i < len; i++) {
    const c = input.charCodeAt(i);

    if (inString) {
      if (escape) {
        escape = false;
        if (c === LOWER_U) {
          uAt = i - 1;
          uNeed = 4;
        }
      } else if (uNeed > 0 && isHex(c)) {
        uNeed--;
      } else {
        uNeed = 0;
        if (c === BACKSLASH) {
          escape = true;
        } else if (c === QUOTE) {
          inString = false;
          cutAt.push(i + 1);
          cutClosers.push(closers);
        }
      }
    } else if (c === QUOTE) {
      inString = true;
    } else if (c === LBRACE || c === LBRACKET) {
      closers = (c === LBRACE ? "}" : "]") + closers;
      cutAt.push(i + 1);
      cutClosers.push(closers);
    } else if (c === RBRACE || c === RBRACKET) {
      closers = closers.slice(1);
      cutAt.push(i + 1);
      cutClosers.push(closers);
    } else if (c === COMMA && cutAt[cutAt.length - 1] !== i) {
      // Right before a structural comma: whatever preceded it (number,
      // literal, etc.) is a complete value.
      cutAt.push(i);
      cutClosers.push(closers);
    }
  }

  // Trim an incomplete escape sequence off the tail of an open string.
  let end = len;
  if (inString) {
    if (escape) end = len - 1;
    else if (uNeed > 0) end = uAt;
  }

  // Attempt 1: close the open string (if any) and every open container.
  let result = tryParse(input.slice(0, end) + (inString ? '"' : "") + closers);
  if (result !== undefined) return result;

  // Attempt 2: rewind to each safe cut point, newest first.
  for (let k = cutAt.length - 1; k >= 0; k--) {
    const at = cutAt[k] as number;
    // Identical to attempt 1 — skip.
    if (at === end && !inString) continue;
    result = tryParse(input.slice(0, at) + cutClosers[k]);
    if (result !== undefined) return result;
  }

  return undefined;
}

/**
 * Create a stateful stream that accumulates chunks and re-parses on each
 * `feed`. A thin convenience wrapper around {@link parsePartialJSON}.
 *
 * @returns An object with `feed(chunk)` returning the current best-effort
 *   parse, and `raw` exposing the full accumulated buffer.
 *
 * @example
 * ```ts
 * const stream = createJSONStream();
 * for await (const chunk of llmResponse) {
 *   const value = stream.feed(chunk);
 *   if (value !== undefined) render(value);
 * }
 * console.log(stream.raw); // the full text that was received
 * ```
 */
export function createJSONStream(): JSONStream {
  let raw = "";
  return {
    feed(chunk: string): unknown {
      raw += chunk;
      return parsePartialJSON(raw);
    },
    get raw(): string {
      return raw;
    },
  };
}
