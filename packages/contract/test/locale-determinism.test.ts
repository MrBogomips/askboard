import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { FORMAT_CASES, formatResults } from "./locale/cases.ts";

const SCRIPT = join(import.meta.dir, "locale", "print-results.ts");

// AD-13 (settings-languages B17): the formats ignore the runtime's time zone and locale. Two
// extreme zones, each with two locales, as compute's determinism test runs them.
const ENVIRONMENTS = ["Pacific/Kiritimati", "America/Adak"].flatMap((zone) =>
  ["en_US.UTF-8", "de_DE.UTF-8"].map((locale) => ({ TZ: zone, LANG: locale, LC_ALL: locale })),
);

const resultsIn = (env: Record<string, string>): unknown => {
  const run = Bun.spawnSync([process.execPath, SCRIPT], { env: { ...process.env, ...env } });
  if (run.exitCode !== 0) throw new Error(run.stderr.toString());
  return JSON.parse(run.stdout.toString());
};

describe("determinism of the locale formats", () => {
  test("every fixture gives its text whatever the time zone and runtime locale", () => {
    const expected = Object.fromEntries(
      FORMAT_CASES.map((entry) => [entry.name, [entry["en-US"], entry["it-IT"]] as const]),
    );
    expect(formatResults()).toEqual(expected);
    for (const env of ENVIRONMENTS) {
      expect({ env, results: resultsIn(env) }).toEqual({ env, results: expected });
    }
  }, 60_000);
});
