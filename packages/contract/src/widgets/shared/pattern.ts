// The safe subset of a TextField's `pattern` (form-widget, design decision 3; NFR-5, AD-8): what
// `ask` and `update` accept, decided in one pass over the pattern after a compile with the `u` flag.
// The pattern runs only in the view, on the user's text; this check never runs it.
//
// The subset leaves no backreference, no lookahead or lookbehind, no group form but `(?:` and
// `(?<name>` (a name used once), and no group repeated by `*`, `+` or a braced quantifier other than
// `{0}` and `{1}` that holds a quantifier or an alternation, the shapes whose matching time grows
// exponentially with the text, and no property escape but a General_Category value or an ECMAScript
// 2018 binary property (`property-names.ts`): a script newer than the user's browser would not
// compile. It also holds a cost budget, `PATTERN_MAX_REPEATS`: the matching time grows with the
// number of variable quantifiers and alternations written in a row, so each quantifier with a range
// (`?`, `*`, `+`, `{n,}`, `{n,m}` with m over n), each group holding a `|` (the whole pattern counts
// as one when it holds a top-level `|`) and a pattern with no leading `^` count one each. A fixed
// tail after the quantifiers multiplies each attempt, so a field with a pattern holds at most
// `PATTERN_TEXT_MAX_CHARS` characters. The one pass is linear in the pattern: it tracks escapes,
// classes and a stack of groups, and builds no regular expression but the compile that proves the
// pattern is one. Plain ECMAScript, no DOM, Node or Bun API.

import { propertyNameAllowed } from "./property-names.ts";

/** A pattern is at most this many code points. */
export const PATTERN_MAX_CHARS = 200;
/**
 * A TextField with a pattern holds at most this many code points, which is also its limit when
 * `maxLength` is absent: the worst admitted shape matched 100 characters in at most 146 ms on Node 24
 * (task 1.12), where 1,000 characters took minutes.
 */
export const PATTERN_TEXT_MAX_CHARS = 100;
/** A pattern costs at most this many repetitions (see the header), read by every layer. */
export const PATTERN_MAX_REPEATS = 3;

/** `quantifier` and `alternation` reach the parent group; `piped` is this group's own `|`. */
type Frame = { quantifier: boolean; alternation: boolean; piped: boolean };

/**
 * A quantifier read at a position: where it ends, whether it repeats without a fixed 0 or 1, and
 * whether its count can vary (`?`, `*`, `+`, `{n,}`, `{n,m}` with m over n), which the budget counts.
 */
type Quantifier = {
  readonly end: number;
  readonly repeats: boolean;
  readonly variable: boolean;
};

const isDigit = (char: string | undefined): boolean =>
  char !== undefined && char >= "0" && char <= "9";

/** The whole number the digits from `from` spell, and where they stop. */
const numberAt = (chars: readonly string[], from: number): { value: number; end: number } => {
  let end = from;
  let value = 0;
  while (isDigit(chars[end])) {
    value = Math.min(value * 10 + Number(chars[end]), 1_000_000);
    end += 1;
  }
  return { value, end };
};

/**
 * The quantifier that starts at `at`, with its lazy marker, or none. A braced quantifier after a
 * successful compile is always whole (`{n}`, `{n,}` or `{n,m}`): the `u` flag refuses a lone brace.
 */
const quantifierAt = (chars: readonly string[], at: number): Quantifier | undefined => {
  const char = chars[at];
  let end = at + 1;
  let repeats = true;
  let variable = true;
  if (char === "?") repeats = false;
  else if (char === "{") {
    const low = numberAt(chars, end);
    end = low.end;
    const ranged = chars[end] === ",";
    variable = false;
    if (ranged) {
      const high = numberAt(chars, end + 1);
      variable = high.end === end + 1 || high.value > low.value;
      end = high.end;
    }
    repeats = ranged || low.value > 1;
    end += 1;
  } else if (char !== "*" && char !== "+") return undefined;
  return { end: chars[end] === "?" ? end + 1 : end, repeats, variable };
};

/** Where the escape that starts at `at` (a backslash) ends, past a braced `\p{…}` or `\u{…}`. */
const escapeEnd = (chars: readonly string[], at: number): number => {
  const kind = chars[at + 1];
  if ((kind === "p" || kind === "P" || kind === "u") && chars[at + 2] === "{") {
    const close = chars.indexOf("}", at + 3);
    return close === -1 ? chars.length : close + 1;
  }
  return at + 2;
};

/**
 * Why the property escape that starts at `at` (a backslash) is outside the subset, or `undefined`:
 * `\p{…}` and `\P{…}` name a General_Category value or an ECMAScript 2018 binary property only.
 */
const propertyRefusal = (chars: readonly string[], at: number): string | undefined => {
  const kind = chars[at + 1];
  if ((kind !== "p" && kind !== "P") || chars[at + 2] !== "{") return undefined;
  const end = escapeEnd(chars, at);
  const name = chars.slice(at + 3, end - 1).join("");
  return propertyNameAllowed(name)
    ? undefined
    : `names the property ${name}, which is neither a General_Category value nor an ECMAScript 2018 binary property, so not every browser reads it`;
};

/** Where the class that opens at `at` ends, and the first property refusal inside it. */
const classEnd = (
  chars: readonly string[],
  at: number,
): { readonly end: number; readonly refusal?: string } => {
  let each = at + 1;
  let refusal: string | undefined;
  while (each < chars.length && chars[each] !== "]") {
    if (chars[each] === "\\") {
      refusal ??= propertyRefusal(chars, each);
      each = escapeEnd(chars, each);
    } else each += 1;
  }
  return refusal === undefined ? { end: each + 1 } : { end: each + 1, refusal };
};

/**
 * What follows `(` at `at`: the kind of group and where its header ends. Only `(`, `(?:` and
 * `(?<name>` are inside the subset, with a name used once and spelled without an escape: a modifier
 * group (`(?i:…)`) or a repeated name compiles on some engines and not on the user's browser.
 */
const groupHeader = (
  chars: readonly string[],
  at: number,
  names: Set<string>,
): { readonly refusal?: string; readonly end: number } => {
  if (chars[at + 1] !== "?") return { end: at + 1 };
  const kind = chars[at + 2];
  if (kind === "=" || kind === "!") return { refusal: "holds a lookahead", end: at + 3 };
  if (kind === ":") return { end: at + 3 };
  if (kind !== "<") return { refusal: MODIFIER, end: at + 2 };
  const sign = chars[at + 3];
  if (sign === "=" || sign === "!") return { refusal: "holds a lookbehind", end: at + 4 };
  const close = chars.indexOf(">", at + 3);
  const name = chars.slice(at + 3, close === -1 ? chars.length : close).join("");
  if (name.includes("\\")) return { refusal: `names a group with an escape (${name})`, end: at };
  if (names.has(name)) return { refusal: `names the group ${name} twice`, end: at };
  names.add(name);
  return { end: close === -1 ? chars.length : close + 1 };
};

const MODIFIER =
  "holds a group form other than (?: and (?<name>, such as a modifier group, which not every browser reads";

const REPEATED =
  "holds a repeated group that itself holds a quantifier or an alternation, which can match in exponential time";

/**
 * Why `pattern` is outside the safe subset, a phrase that completes "the pattern …", or `undefined`
 * when it is inside. Never throws, and never runs the pattern.
 */
export const patternProblem = (pattern: string): string | undefined => {
  const chars = Array.from(pattern);
  if (chars.length > PATTERN_MAX_CHARS) {
    return `is ${chars.length} characters, over the limit of ${PATTERN_MAX_CHARS}`;
  }
  try {
    new RegExp(pattern, "u");
  } catch {
    return "does not compile as an ECMAScript regular expression with the u flag";
  }
  const groups: Frame[] = [];
  const names = new Set<string>();
  let repeats = chars[0] === "^" ? 0 : 1;
  let topPiped = false;
  const top = (): Frame | undefined => groups[groups.length - 1];
  let at = 0;
  while (at < chars.length) {
    const char = chars[at];
    if (char === "\\") {
      const next = chars[at + 1];
      if (next === "k" || (next !== undefined && next >= "1" && next <= "9")) {
        return `holds a backreference (\\${next})`;
      }
      const refusal = propertyRefusal(chars, at);
      if (refusal !== undefined) return refusal;
      at = escapeEnd(chars, at);
    } else if (char === "[") {
      const inClass = classEnd(chars, at);
      if (inClass.refusal !== undefined) return inClass.refusal;
      at = inClass.end;
    } else if (char === "(") {
      const header = groupHeader(chars, at, names);
      if (header.refusal !== undefined) return header.refusal;
      groups.push({ quantifier: false, alternation: false, piped: false });
      at = header.end;
    } else if (char === ")") {
      const frame = groups.pop();
      const quantifier = quantifierAt(chars, at + 1);
      if (frame !== undefined && quantifier?.repeats && (frame.quantifier || frame.alternation)) {
        return REPEATED;
      }
      if (frame?.piped) repeats += 1;
      if (quantifier?.variable) repeats += 1;
      const parent = top();
      if (parent !== undefined && frame !== undefined) {
        parent.quantifier ||= frame.quantifier || quantifier !== undefined;
        parent.alternation ||= frame.alternation;
      }
      at = quantifier === undefined ? at + 1 : quantifier.end;
    } else if (char === "|") {
      const frame = top();
      if (frame === undefined) topPiped = true;
      else {
        frame.alternation = true;
        frame.piped = true;
      }
      at += 1;
    } else {
      const quantifier = quantifierAt(chars, at);
      if (quantifier === undefined) at += 1;
      else {
        const frame = top();
        if (frame !== undefined) frame.quantifier = true;
        if (quantifier.variable) repeats += 1;
        at = quantifier.end;
      }
    }
  }
  if (topPiped) repeats += 1;
  if (repeats > PATTERN_MAX_REPEATS) {
    return `costs ${repeats} repetitions, over the limit of ${PATTERN_MAX_REPEATS} (each ?, *, +, {n,} and {n,m}, each group holding a |, and no leading ^ count one)`;
  }
  return undefined;
};
