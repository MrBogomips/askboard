import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { legendEntries, looksCritical } from "./legend.ts";

describe("the legend", () => {
  test("lists the critical entry while the highlighting is on", () => {
    expect(legendEntries(true, false)).toEqual(["task", "critical", "change"]);
  });

  test("lists task and your change only with the highlighting off", () => {
    expect(legendEntries(false, false)).toEqual(["task", "change"]);
  });

  test("keeps the agent's plan entry in both states", () => {
    expect(legendEntries(true, true)).toEqual(["task", "critical", "change", "baseline"]);
    expect(legendEntries(false, true)).toEqual(["task", "change", "baseline"]);
  });
});

describe("the critical look", () => {
  test("a task is drawn critical only when it is, and the switch is on", () => {
    expect(looksCritical(true, true)).toBe(true);
    expect(looksCritical(true, false)).toBe(false);
    expect(looksCritical(false, true)).toBe(false);
    expect(looksCritical(false, false)).toBe(false);
  });
});

describe("the switch is view state", () => {
  const source = (file: string) => readFileSync(join(import.meta.dir, "..", file), "utf8");

  test("neither the draft path nor the edits mention it", () => {
    for (const file of ["index.tsx", "model/edits.ts", "model/marks.ts", "model/schedule.ts"]) {
      expect(source(file)).not.toMatch(/showCritical/);
    }
  });

  test("the frame keeps it in React state and never commits it", () => {
    const frame = source("frame.tsx");
    expect(frame).toMatch(/const \[showCritical, setShowCritical\] = useState\(true\)/);
    expect(frame).not.toMatch(/onCommit\([^)]*showCritical/);
  });
});
