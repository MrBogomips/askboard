import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { timeOf, viewerOffset } from "../src/shell/thread-text.ts";
import { VIEW_CASES, viewerTimes, viewResults } from "./locale/view-cases.ts";

const SCRIPT = join(import.meta.dir, "locale", "print-view-results.ts");

// AD-13 (settings-languages, task 7.3, as the contract's formats in task 2.3): the view's values
// ignore the runtime's locale, and a time follows the viewer's time zone only through its offset.
// The two extreme zones on 2026-10-31: Kiritimati at +14:00 and Adak at -09:00 (daylight time).
const ZONES = [
  { zone: "Pacific/Kiritimati", viewer: ["7:42 AM", "07:42"] },
  { zone: "America/Adak", viewer: ["8:42 AM", "08:42"] },
] as const;
const ENVIRONMENTS = ZONES.flatMap(({ zone, viewer }) =>
  ["en_US.UTF-8", "de_DE.UTF-8"].map((locale) => ({
    env: { TZ: zone, LANG: locale, LC_ALL: locale },
    viewer,
  })),
);

const resultsIn = (env: Record<string, string>): unknown => {
  const run = Bun.spawnSync([process.execPath, SCRIPT], { env: { ...process.env, ...env } });
  if (run.exitCode !== 0) throw new Error(run.stderr.toString());
  return JSON.parse(run.stdout.toString());
};

describe("determinism of the view's values", () => {
  test("every fixture gives its text, and a message time the viewer's, whatever the zone and locale", () => {
    const fixed = Object.fromEntries(
      VIEW_CASES.map((entry) => [entry.name, [entry["en-US"], entry["it-IT"]] as const]),
    );
    expect(viewResults()).toEqual(fixed);
    const when = "2026-10-31T17:42:05Z";
    expect(viewerTimes(when)).toEqual([
      timeOf(when, "en-US", viewerOffset(when)),
      timeOf(when, "it-IT", viewerOffset(when)),
    ]);
    for (const { env, viewer } of ENVIRONMENTS) {
      expect({ env, results: resultsIn(env) }).toEqual({ env, results: { fixed, viewer } });
    }
  }, 60_000);
});
