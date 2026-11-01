// The client version gate (AD-18; mcp-adapter spec, Supported Claude Code versions): ask-core
// holds the Claude Code version that the protocol's client information or the mod names, and
// refuses a new ask from a version below the contract's minimum.

import { CLAUDE_CODE_MINIMUM } from "@askboard/contract";
import type { ClientVersionSource, Diagnose, PushAskOutcome } from "./ports.ts";

/** The diagnostic written once when an ask proceeds with no Claude Code version known (AD-18). */
export const UNKNOWN_VERSION_DIAGNOSTIC = `the Claude Code version is unknown, so asks are not checked against the minimum ${CLAUDE_CODE_MINIMUM}`;

// Longer than any version Claude Code writes; a longer text is not read, so no error carries it.
const VERSION_MAX_CHARS = 64;
const IDENTIFIERS = "[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*";
// Numbers separated by dots, then an optional pre-release and build metadata, as semver writes them.
const VERSION = new RegExp(`^(\\d+(?:\\.\\d+)*)(?:-(${IDENTIFIERS}))?(?:\\+${IDENTIFIERS})?$`);
const NUMERIC = /^\d+$/;

type Parsed = { readonly release: readonly number[]; readonly pre?: readonly string[] };

const parse = (version: string): Parsed | undefined => {
  const match = version.length > VERSION_MAX_CHARS ? null : VERSION.exec(version);
  if (match === null) return undefined;
  const release = (match[1] as string).split(".").map(Number);
  if (!release.every(Number.isSafeInteger)) return undefined;
  return match[2] === undefined ? { release } : { release, pre: match[2].split(".") };
};

const sign = (difference: number): -1 | 0 | 1 => {
  if (difference < 0) return -1;
  return difference > 0 ? 1 : 0;
};

// Semver's order of pre-release identifiers: numbers as numbers and below text, text in ASCII
// order, and with equal leading identifiers the longer list above the shorter.
const comparePre = (a: readonly string[], b: readonly string[]): -1 | 0 | 1 => {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const [x, y] = [a[index], b[index]];
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    if (x === y) continue;
    const [xNumeric, yNumeric] = [NUMERIC.test(x), NUMERIC.test(y)];
    if (xNumeric && yNumeric) return sign(Number(x) - Number(y));
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
};

/**
 * -1, 0 or 1 as `a` is below, at or above `b`: numerically per dot-separated part, a missing part
 * counting as 0, and a pre-release below its release. Undefined when either cannot be read.
 */
export const compareVersions = (a: string, b: string): -1 | 0 | 1 | undefined => {
  const [x, y] = [parse(a), parse(b)];
  if (x === undefined || y === undefined) return undefined;
  for (let index = 0; index < Math.max(x.release.length, y.release.length); index += 1) {
    const order = sign((x.release[index] ?? 0) - (y.release[index] ?? 0));
    if (order !== 0) return order;
  }
  if (x.pre === undefined || y.pre === undefined) {
    if (x.pre === y.pre) return 0;
    return x.pre === undefined ? 1 : -1;
  }
  return comparePre(x.pre, y.pre);
};

// The sources in the order the gate reads them: the client information wins over the mod's report.
const SOURCES: readonly ClientVersionSource[] = ["client-info", "mod"];

export class VersionGate {
  readonly #diagnose: Diagnose | undefined;
  readonly #versions = new Map<ClientVersionSource, string>();
  #unknownReported = false;

  constructor(diagnose: Diagnose | undefined) {
    this.#diagnose = diagnose;
  }

  /** Records the version a source names; the client information wins over the mod's report. */
  set(source: ClientVersionSource, version: string): void {
    this.#versions.set(source, version);
  }

  /**
   * The refusal of a new ask from a known version below the minimum, or undefined when the ask may
   * be created. The client information's version is read first, and the mod's when that one is
   * missing or cannot be read. With neither readable, the ask may be created, and that is
   * diagnosed once.
   */
  refusal(askId: string): PushAskOutcome | undefined {
    const known = SOURCES.flatMap((source) => {
      const version = this.#versions.get(source);
      const order =
        version === undefined ? undefined : compareVersions(version, CLAUDE_CODE_MINIMUM);
      return version === undefined || order === undefined ? [] : [{ version, order }];
    })[0];
    if (known === undefined) {
      if (!this.#unknownReported) this.#diagnose?.(UNKNOWN_VERSION_DIAGNOSTIC);
      this.#unknownReported = true;
      return undefined;
    }
    if (known.order >= 0) return undefined;
    const { version } = known;
    return { kind: "unsupported-version", askId, version, minimum: CLAUDE_CODE_MINIMUM };
  }
}
