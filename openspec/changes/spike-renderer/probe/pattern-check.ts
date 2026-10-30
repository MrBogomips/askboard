// S-8: the safe `pattern` subset, checked when an ask is sent, as `ask-core` will need it. A Form
// field's `pattern` is accepted when it is a valid ECMAScript regular expression with no
// backreference, no lookahead or lookbehind, and no quantified group that holds a quantifier.
// The check uses ECMAScript only (no DOM, Node-only or Bun-only API): it compiles under
// `lib: ["ES2022"]` with no types (`console` is declared below for the runner).
//
//   bun pattern-check.ts   runs the fixture list and exits non-zero on a wrong answer

declare const console: { log: (...values: unknown[]) => void };

export type PatternVerdict = { ok: true } | { ok: false; message: string };

const QUANTIFIER = /^(?:[*+?]|\{\d+(?:,\d*)?\})/;
// An outer quantifier that repeats without bound or more than once; `?` and `{0,1}` do not.
const REPEATING = /^(?:[*+]|\{\d+,\d*\}|\{(?:[2-9]|\d{2,})\})/;

const refusal = (itemId: string, pattern: string, reason: string): PatternVerdict => ({
  ok: false,
  message: `item ${itemId}: pattern ${JSON.stringify(pattern)} ${reason}, outside the safe subset (S-8)`,
});

export const checkPattern = (itemId: string, pattern: string): PatternVerdict => {
  try {
    new RegExp(pattern, "u");
  } catch (error) {
    return refusal(itemId, pattern, `is not a valid regular expression (${(error as Error).message})`);
  }
  // One entry per open group: whether it holds a quantifier, directly or in a nested group.
  const groups: boolean[] = [];
  let inClass = false;
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    const rest = pattern.slice(i);
    if (char === "\\") {
      const next = pattern[i + 1] ?? "";
      if (!inClass && /[1-9]/.test(next)) return refusal(itemId, pattern, `uses a backreference (\\${next})`);
      if (!inClass && next === "k") return refusal(itemId, pattern, "uses a named backreference (\\k<…>)");
      i += 1;
      continue;
    }
    if (inClass) {
      if (char === "]") inClass = false;
      continue;
    }
    if (char === "[") {
      inClass = true;
      continue;
    }
    if (char === "(") {
      if (rest.startsWith("(?=") || rest.startsWith("(?!")) return refusal(itemId, pattern, "uses a lookahead");
      if (rest.startsWith("(?<=") || rest.startsWith("(?<!")) return refusal(itemId, pattern, "uses a lookbehind");
      groups.push(false);
      continue;
    }
    if (char === ")") {
      const quantified = groups.pop() ?? false;
      const after = pattern.slice(i + 1);
      if (quantified && REPEATING.test(after)) {
        return refusal(itemId, pattern, "nests quantifiers (a repeated group holds a quantifier)");
      }
      if (groups.length > 0 && (quantified || QUANTIFIER.test(after))) groups[groups.length - 1] = true;
      continue;
    }
    if (QUANTIFIER.test(rest) && groups.length > 0) groups[groups.length - 1] = true;
  }
  return { ok: true };
};

// The fixture list: each pattern with the answer the check must give.
export const PATTERN_FIXTURES: { id: string; pattern: string; accept: boolean }[] = [
  { id: "f-name", pattern: "^[A-Z][a-z]+$", accept: true },
  { id: "f-phone", pattern: "^\\d{3}-\\d{4}$", accept: true },
  { id: "f-email", pattern: "^[\\w.+-]+@[\\w-]+\\.[a-z]{2,}$", accept: true },
  { id: "f-host", pattern: "^(?:[a-z0-9-]+\\.)?example\\.org$", accept: true },
  { id: "f-month", pattern: "^(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])$", accept: true },
  { id: "f-choice", pattern: "^(?:red|green|blue)$", accept: true },
  { id: "f-class", pattern: "^[(+*)\\]]+$", accept: true },
  { id: "f-ticket", pattern: "^[A-Z]{2,5}-[0-9]+$", accept: true },
  { id: "r-backref", pattern: "^(a)\\1$", accept: false },
  { id: "r-named-backref", pattern: "^(?<x>a)\\k<x>$", accept: false },
  { id: "r-lookahead", pattern: "^(?=.*\\d).+$", accept: false },
  { id: "r-negative-lookahead", pattern: "^(?!admin$).*$", accept: false },
  { id: "r-lookbehind", pattern: "(?<=\\$)\\d+", accept: false },
  { id: "r-negative-lookbehind", pattern: "(?<!x)y", accept: false },
  { id: "r-nested-plus", pattern: "^(a+)+$", accept: false },
  { id: "r-nested-star", pattern: "^(?:\\w*\\s?)*$", accept: false },
  { id: "r-nested-braces", pattern: "^(\\d{2,})+$", accept: false },
  { id: "r-nested-deep", pattern: "^((ab)*c)+$", accept: false },
  { id: "r-invalid", pattern: "^(abc$", accept: false },
];

export const selfCheck = (): { ok: boolean; lines: string[] } => {
  const lines = PATTERN_FIXTURES.map(({ id, pattern, accept }) => {
    const verdict = checkPattern(id, pattern);
    const right = verdict.ok === accept;
    const said = verdict.ok ? "accepted" : `refused: ${verdict.message}`;
    return `${right ? "ok   " : "WRONG"} ${id.padEnd(22)} ${said}`;
  });
  return { ok: lines.every((line) => line.startsWith("ok")), lines };
};

// Bun and Deno set `import.meta.main` on the entry module only; in the view's bundle it is
// undefined, so importing the check runs nothing.
if ((import.meta as { main?: boolean }).main) {
  const { ok, lines } = selfCheck();
  for (const line of lines) console.log(line);
  const refused = PATTERN_FIXTURES.filter((f) => !f.accept).length;
  console.log(`pattern-check: ${PATTERN_FIXTURES.length - refused} accepted, ${refused} refused, ${ok ? "all as listed" : "WRONG ANSWERS"}`);
  if (!ok) throw new Error("pattern-check: a fixture got the wrong answer");
}
