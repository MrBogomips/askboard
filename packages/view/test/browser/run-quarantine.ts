// The browser run's quarantine and verdicts (#227 point 2). `known-failures.json` lists, keyed by the
// number of the open Issue that holds each, the failures the run reports but does not fail on; the
// change that closes an Issue removes its entry. A failure is known when its file, a part of its
// test's name and its engine match an entry; otherwise flaky when its file, run again alone, passed
// it; otherwise new, and a new failure fails the run. Pure, so that it is unit-tested.

import { ENGINES, type Engine } from "./harness/engines.ts";
import type { Failure, JudgedFailure } from "./run-digest.ts";
import type { PassSet } from "./run-plan.ts";

export const KNOWN_FAILURES_FILE = "packages/view/test/browser/known-failures.json";

export type KnownFailure = {
  readonly issue: number;
  /** A browser file's name, without its folder. */
  readonly file: string;
  /** A part of the test's full name; the whole file when absent. */
  readonly test?: string;
  /** The engines it fails in; every engine when absent. */
  readonly engines?: readonly Engine[];
};

const refuse = (reason: string): never => {
  throw new Error(`${KNOWN_FAILURES_FILE}: ${reason}`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const FAILURE_FIELDS = ["file", "test", "engines"];
const BROWSER_FILE = /^[a-z0-9][a-z0-9.-]*\.browser\.ts$/;

const engineOf = (where: string, name: unknown): Engine =>
  ENGINES.find((engine) => engine === name) ??
  refuse(`${where}: unknown engine ${JSON.stringify(name)} (${ENGINES.join(", ")})`);

const failureOf = (issue: number, where: string, value: unknown): KnownFailure => {
  if (!isRecord(value)) return refuse(`${where} is not an object`);
  const extra = Object.keys(value).find((key) => !FAILURE_FIELDS.includes(key));
  if (extra !== undefined) refuse(`${where}: unknown field ${JSON.stringify(extra)}`);
  const { file, test, engines } = value;
  if (typeof file !== "string" || !BROWSER_FILE.test(file)) {
    refuse(
      `${where}: "file" must name a browser file (<name>.browser.ts), not ${JSON.stringify(file)}`,
    );
  }
  if (test !== undefined && (typeof test !== "string" || test === "")) {
    refuse(`${where}: "test" must be a non-empty part of a test's name`);
  }
  if (engines !== undefined && (!Array.isArray(engines) || engines.length === 0)) {
    refuse(`${where}: "engines" must be a non-empty list`);
  }
  return {
    issue,
    file: file as string,
    ...(test === undefined ? {} : { test: test as string }),
    ...(engines === undefined
      ? {}
      : { engines: (engines as unknown[]).map((name) => engineOf(where, name)) }),
  };
};

/** The quarantine file's entries, one per failure; throws the reason on anything malformed. */
export const parseKnownFailures = (json: unknown): KnownFailure[] => {
  if (!isRecord(json)) return refuse("must be an object");
  if (json.version !== 1) refuse("must be version 1");
  if (!isRecord(json.issues)) return refuse('"issues" must be an object keyed by Issue number');
  return Object.entries(json.issues).flatMap(([key, value]) => {
    if (!/^[1-9]\d*$/.test(key)) refuse(`Issue key ${JSON.stringify(key)} is not an Issue number`);
    const where = `Issue #${key}`;
    if (!isRecord(value)) return refuse(`${where} is not an object`);
    if (typeof value.title !== "string" || value.title === "") {
      refuse(`${where} needs a "title" saying what fails`);
    }
    if (!Array.isArray(value.failures) || value.failures.length === 0) {
      refuse(`${where} needs at least one failure`);
    }
    return (value.failures as unknown[]).map((failure, at) =>
      failureOf(Number(key), `${where}, failure ${at + 1}`, failure),
    );
  });
};

/** The Issue that quarantines this failure in this engine, if any. */
export const knownIssueOf = (
  known: readonly KnownFailure[],
  engine: Engine,
  failure: Pick<Failure, "file" | "test">,
): number | undefined =>
  known.find(
    (entry) =>
      entry.file === failure.file &&
      (entry.test === undefined || failure.test.includes(entry.test)) &&
      (entry.engines === undefined || entry.engines.includes(engine)),
  )?.issue;

/** One rerun of a file, alone: its exit code and its failures. */
export type Rerun = { readonly code: number; readonly failures: readonly Failure[] };

export type JudgeInput = {
  readonly set: PassSet;
  readonly engine: Engine;
  readonly failures: readonly Failure[];
  /** The reruns of each file, by file name. */
  readonly reruns: Readonly<Record<string, readonly Rerun[]>>;
  readonly known: readonly KnownFailure[];
};

// A rerun proves a test passed only when it ran: exit 0, or failures named that leave it out. A
// rerun that failed with no failing test named (a crash) proves nothing.
const passedIn = (rerun: Rerun, failure: Failure): boolean =>
  (rerun.code === 0 || rerun.failures.length > 0) &&
  !rerun.failures.some((again) => again.test === failure.test);

/** Each failure of a pass, judged known, flaky or new. */
export const judgeFailures = ({
  set,
  engine,
  failures,
  reruns,
  known,
}: JudgeInput): JudgedFailure[] =>
  failures.map((failure) => {
    const issue = knownIssueOf(known, engine, failure);
    if (issue !== undefined) return { ...failure, set, engine, verdict: "known", issue };
    const flaky = (reruns[failure.file] ?? []).some((rerun) => passedIn(rerun, failure));
    return { ...failure, set, engine, verdict: flaky ? "flaky" : "new" };
  });
