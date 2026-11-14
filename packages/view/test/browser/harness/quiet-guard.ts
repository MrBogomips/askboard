// The guard of e2e-cadence's decision 7 (tasks 4.1 and 4.5): no browser file waits a fixed
// `QUIET_MS` for something to have happened. A site waits on a round-trip probe (`probes.ts`), or
// names why no probe fits through `quiet("<reason>")`. The guard refuses a `Bun.sleep(` whose
// argument names `QUIET_MS` (whole or any fraction) or is the number it holds, written either way
// (`1500`, `1_500`, `1500 / 3`; C4), and a `quiet(` call that gives no reason.

/** The text with every comment blanked out (newlines and length kept); strings are left alone. */
export const withoutComments = (text: string): string => {
  const out = text.split("");
  const blank = (from: number, to: number) => {
    for (let at = from; at < to; at += 1) if (out[at] !== "\n") out[at] = " ";
  };
  let at = 0;
  while (at < text.length) {
    const char = text[at] as string;
    const next = text[at + 1];
    if (char === "/" && next === "/") {
      const end = text.indexOf("\n", at);
      const stop = end < 0 ? text.length : end;
      blank(at, stop);
      at = stop;
    } else if (char === "/" && next === "*") {
      const end = text.indexOf("*/", at + 2);
      const stop = end < 0 ? text.length : end + 2;
      blank(at, stop);
      at = stop;
    } else if (char === '"' || char === "'" || char === "`") {
      let end = at + 1;
      while (end < text.length && text[end] !== char) end += text[end] === "\\" ? 2 : 1;
      at = end + 1;
    } else {
      at += 1;
    }
  }
  return out.join("");
};

// The text between the parenthesis that opens at `open` and its match, strings skipped; null when
// the call never closes.
const argumentAt = (text: string, open: number): string | null => {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    const char = text[at] as string;
    if (char === '"' || char === "'" || char === "`") {
      at += 1;
      while (at < text.length && text[at] !== char) at += text[at] === "\\" ? 2 : 1;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, at);
    }
  }
  return null;
};

const lineOf = (text: string, at: number): number => text.slice(0, at).split("\n").length;

const number = (digits: string): number => Number(digits.replace(/_/g, ""));

// Why a sleep's argument is the quiet wait, or null when it is some other duration.
const sleepProblem = (argument: string, quietMs: number): string | null => {
  const text = argument.trim();
  if (/\bQUIET_MS\b/.test(text)) {
    return "waits on QUIET_MS: use viewSettled, hostSettled, draftSettled or timerSettled, or quiet(reason)";
  }
  const whole = /^(\d[\d_]*)$/.exec(text);
  if (whole !== null && number(whole[1] as string) === quietMs) {
    return `sleeps ${quietMs} ms, the value of QUIET_MS: use a probe, or quiet(reason)`;
  }
  const fraction = /^(\d[\d_]*)\s*\/\s*\d[\d_]*$/.exec(text);
  if (fraction !== null && number(fraction[1] as string) === quietMs) {
    return `sleeps a fraction of ${quietMs} ms, the value of QUIET_MS: use a probe, or quiet(reason)`;
  }
  return null;
};

// The reason a `quiet(` call gives, when it is a plain string literal with text in it.
const reasonProblem = (argument: string): string | null => {
  const literal = /^\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*(?:,\s*)?$/s.exec(argument);
  if (literal === null) return "quiet() takes its reason as a string literal";
  if ((literal[1] === "`" && literal[2]?.includes("$" + "{")) === true) {
    return "quiet() takes its reason as a plain string literal, with no substitution in it";
  }
  if (literal[2]?.trim() === "") return "quiet() needs a reason: the string is empty";
  return null;
};

/**
 * Every wait in `files` (file name to its text) the decision refuses, as "<file>:<line>: <why>",
 * in file and line order. `quietMs` is the value `QUIET_MS` holds.
 */
export const quietWaitProblems = (files: Readonly<Record<string, string>>, quietMs: number) => {
  const problems: string[] = [];
  for (const name of Object.keys(files).sort()) {
    const text = withoutComments(files[name] as string);
    const found: { at: number; why: string }[] = [];
    for (const match of text.matchAll(/\bBun\.sleep\(/g)) {
      const open = match.index + match[0].length - 1;
      const argument = argumentAt(text, open);
      const why = argument === null ? null : sleepProblem(argument, quietMs);
      if (why !== null) found.push({ at: match.index, why });
    }
    for (const match of text.matchAll(/(?<![.\w$])quiet\(/g)) {
      const open = match.index + match[0].length - 1;
      const argument = argumentAt(text, open);
      const why = argument === null ? "quiet( never closes" : reasonProblem(argument);
      if (why !== null) found.push({ at: match.index, why });
    }
    for (const { at, why } of found.sort((a, b) => a.at - b.at)) {
      problems.push(`${name}:${lineOf(text, at)}: ${why}`);
    }
  }
  return problems;
};
