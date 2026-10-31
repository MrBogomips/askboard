// Which session side the browser tests talk to (design decision 11): the test server, which
// replays Track 0's transcripts, or the built session process (task 9.3), and which runtime runs
// that process. `ASKBOARD_E2E_TARGET` and `ASKBOARD_E2E_RUNTIME` choose them; the runner sets both
// from `--target` and `--runtime`.

export const TARGETS = ["test-server", "session-process"] as const;
export type Target = (typeof TARGETS)[number];

/** Bun is the plugin's runtime (design decision 10); CI also runs the bundle on Node 24 (AD-19). */
export const RUNTIMES = ["bun", "node"] as const;
export type Runtime = (typeof RUNTIMES)[number];

const oneOf = <T extends string>(
  what: string,
  variable: string,
  names: readonly T[],
  value: string | undefined,
): T => {
  const name = (value ?? "").trim();
  if (name === "") return names[0] as T;
  const found = names.find((known) => known === name);
  if (found === undefined) {
    throw new Error(`unknown ${what} "${name}" in ${variable}: ${names.join(", ")}`);
  }
  return found;
};

/** The target a variable names; the test server when it is unset or empty. */
export const targetFrom = (value: string | undefined): Target =>
  oneOf("target", "ASKBOARD_E2E_TARGET", TARGETS, value);

/** The runtime a variable names; Bun when it is unset or empty. */
export const runtimeFrom = (value: string | undefined): Runtime =>
  oneOf("runtime", "ASKBOARD_E2E_RUNTIME", RUNTIMES, value);
