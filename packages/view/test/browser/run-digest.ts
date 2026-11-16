// The browser run's digest (#227 point 2): what an agent reads in place of the log. `parseFailures`
// reads `bun test`'s output into one entry per failing test; `formatDigest` prints the counts of
// each pass and one line per failure, marked new, flaky or known, in at most `DIGEST_LIMIT` bytes.
// The full output goes to a log file, which the digest names. Pure, so that it is unit-tested.

import type { Engine } from "./harness/engines.ts";
import type { PassSet } from "./run-plan.ts";

/** The digest's size bound, in bytes: about 2 KB, so that reading it costs an agent nothing. */
export const DIGEST_LIMIT = 2048;
const LINE_LIMIT = 200;

export type Failure = {
  /** The file's name, without its folder. */
  readonly file: string;
  /** The test's full name, its describe blocks joined by " > ", as `bun test` prints it. */
  readonly test: string;
  /** The first line of its error, or "(no error line)". */
  readonly error: string;
};

export type Verdict = "new" | "flaky" | "known";

export type JudgedFailure = Failure & {
  readonly set: PassSet;
  readonly engine: Engine;
  readonly verdict: Verdict;
  /** The Issue that quarantines a known failure. */
  readonly issue?: number;
};

export type PassSummary = {
  readonly set: PassSet;
  readonly engine: Engine;
  readonly pass: number;
  readonly fail: number;
  readonly seconds: number;
  /** The pass's exit code, when it is known. */
  readonly code?: number;
};

export type DigestInput = {
  readonly heading: string;
  readonly log: string;
  readonly passes: readonly PassSummary[];
  readonly failures: readonly JudgedFailure[];
};

const FILE_HEADER = /^(\S.*\.ts):$/;
const FAIL_LINE = /^\(fail\) (.*?)(?: \[[\d.]+m?s\])?$/;
const ERROR_LINE = /^(?:[A-Za-z_$][\w$]*Error|error): /;
const TIMEOUT_LINE = /^\s*\^ (this test timed out after .*)$/;
const UNHANDLED = "# Unhandled error between tests";
const NO_ERROR = "(no error line)";

const baseName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

type Pending = { file: string; test: string; error: string | undefined };

/** One entry per failing test (and per unhandled error between tests), in the output's order. */
export const parseFailures = (output: string): Failure[] => {
  const failures: Failure[] = [];
  let file = "";
  let error: string | undefined;
  // A failure whose error had not been printed yet: a thrown non-Error prints it after `(fail)`.
  let open: Pending | undefined;
  let unhandled: Pending | undefined;
  const close = (): void => {
    for (const pending of [open, unhandled]) {
      if (pending !== undefined) failures.push({ ...pending, error: pending.error ?? NO_ERROR });
    }
    open = undefined;
    unhandled = undefined;
  };
  for (const line of output.split("\n")) {
    const header = FILE_HEADER.exec(line);
    const fail = FAIL_LINE.exec(line);
    const timeout = TIMEOUT_LINE.exec(line);
    if (header !== null) {
      close();
      file = baseName(header[1] ?? "");
      error = undefined;
    } else if (line === UNHANDLED) {
      close();
      unhandled = { file, test: "(unhandled error between tests)", error: undefined };
    } else if (fail !== null) {
      close();
      open = { file, test: fail[1] ?? "", error };
      error = undefined;
    } else if (timeout !== null && open !== undefined && open.error === undefined) {
      open.error = timeout[1];
    } else if (ERROR_LINE.test(line)) {
      const pending = unhandled ?? open;
      if (pending !== undefined && pending.error === undefined) pending.error = line;
      else error ??= line;
    }
  }
  close();
  return failures;
};

const ORDER: readonly Verdict[] = ["new", "flaky", "known"];

const cut = (line: string): string =>
  line.length <= LINE_LIMIT ? line : `${line.slice(0, LINE_LIMIT - 1)}…`;

// A pass that exited non-zero with no failing test named (a crash, a load error bun did not name):
// it fails the run as a new failure of its own, never passes silently (fail closed).
const unexplained = ({ passes, failures }: DigestInput): PassSummary[] =>
  passes.filter(
    (pass) =>
      pass.code !== undefined &&
      pass.code !== 0 &&
      !failures.some((failure) => failure.set === pass.set && failure.engine === pass.engine),
  );

const countOf = (input: DigestInput, verdict: Verdict): number =>
  input.failures.filter((failure) => failure.verdict === verdict).length +
  (verdict === "new" ? unexplained(input).length : 0);

/** True when the run has no new failure: known and flaky ones are reported but pass. */
export const digestPassed = (input: DigestInput): boolean => countOf(input, "new") === 0;

const failureLine = (failure: JudgedFailure): string =>
  cut(
    `  ${failure.verdict.padEnd(5)} ${failure.engine.padEnd(8)} ${failure.file} > ${failure.test}: ${failure.error}${failure.issue === undefined ? "" : ` (#${failure.issue})`}`,
  );

const bytes = (text: string): number => new TextEncoder().encode(text).length;

/** The digest: a verdict line, the counts per pass, the failures, then where the log is. */
export const formatDigest = (input: DigestInput): string => {
  const verdict = digestPassed(input) ? "PASS" : "FAIL";
  const counts = ORDER.map((name) => `${countOf(input, name)} ${name}`).join(", ");
  const head = [
    cut(`${input.heading}: ${verdict}, ${counts}`),
    ...input.passes.map((pass) =>
      cut(
        `  ${pass.set.padEnd(5)} ${pass.engine.padEnd(8)} ${pass.pass} pass, ${pass.fail} fail in ${pass.seconds.toFixed(1)} s`,
      ),
    ),
  ];
  const tail = cut(`full log: ${input.log}`);
  const lines = [
    ...unexplained(input).map((pass) =>
      cut(
        `  new   ${pass.engine.padEnd(8)} the ${pass.set} pass exited ${pass.code} with no failing test named`,
      ),
    ),
    ...ORDER.flatMap((name) =>
      input.failures.filter((failure) => failure.verdict === name).map(failureLine),
    ),
  ];
  const kept: string[] = [];
  for (const [at, line] of lines.entries()) {
    const rest = lines.length - at - 1;
    const more = rest === 0 ? [] : [`  … and ${rest} more failures in the log`];
    if (bytes([...head, ...kept, line, ...more, tail].join("\n")) > DIGEST_LIMIT) {
      kept.push(`  … and ${lines.length - at} more failures in the log`);
      break;
    }
    kept.push(line);
  }
  return [...head, ...kept, tail].join("\n");
};
