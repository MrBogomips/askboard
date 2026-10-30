import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { resultsHash } from "./fixtures/hash.ts";
import { runAll } from "./fixtures/suite.ts";

const SCRIPT = join(import.meta.dir, "fixtures", "print-hash.ts");

// AD-13: derived values ignore time zone and locale. Two extreme zones, each with two locales.
const ENVIRONMENTS = ["Pacific/Kiritimati", "America/Adak"].flatMap((zone) =>
  ["en_US.UTF-8", "de_DE.UTF-8"].map((locale) => ({ TZ: zone, LANG: locale, LC_ALL: locale })),
);

const hashIn = (env: Record<string, string>): string => {
  const run = Bun.spawnSync([process.execPath, SCRIPT], { env: { ...process.env, ...env } });
  if (run.exitCode !== 0) throw new Error(run.stderr.toString());
  return run.stdout.toString().trim();
};

describe("determinism", () => {
  test("every fixture gives one result whatever the time zone and locale", () => {
    const here = resultsHash(runAll());
    expect(here).toMatch(/^[0-9a-f]{64}$/);
    for (const env of ENVIRONMENTS) expect({ env, hash: hashIn(env) }).toEqual({ env, hash: here });
  }, 60_000);
});
