import { describe, expect, test } from "bun:test";
import { ganttBoardDocument } from "@askboard/contract/fixtures";
import { panelBoxes, toggled } from "./predecessors.ts";
import type { GanttOwnProps } from "./tasks.ts";

const [question] = ganttBoardDocument.items;
const [release] = question.props.items;
const SENT = release.props as GanttOwnProps;

/** Fifty tasks after Source, Hub after the fifty, and X after nothing. */
const LIMITS: GanttOwnProps = {
  start: "2026-11-02",
  tasks: [
    { id: "src", label: "Source", duration: 1 },
    ...Array.from({ length: 50 }, (_, index) => ({
      id: `p${index + 1}`,
      label: `P ${index + 1}`,
      duration: 1,
      dependencies: ["src"],
    })),
    {
      id: "hub",
      label: "Hub",
      duration: 1,
      dependencies: Array.from({ length: 50 }, (_, index) => `p${index + 1}`),
    },
    { id: "x", label: "X", duration: 1 },
  ],
};

describe("the predecessors panel's boxes", () => {
  test("list every other task in order, checked as the panel holds them", () => {
    expect(panelBoxes(SENT, "billing", ["architecture"])).toEqual([
      { id: "ux", label: "UX design", checked: false, reason: undefined },
      { id: "architecture", label: "Architecture", checked: true, reason: undefined },
      { id: "prototype", label: "Clickable prototype", checked: false, reason: undefined },
      { id: "portal", label: "Customer portal", checked: false, reason: undefined },
      { id: "reporting", label: "Reporting", checked: false, reason: undefined },
    ]);
  });

  test("give a task that would close a cycle its reason", () => {
    const reasons = panelBoxes(SENT, "prototype", ["ux"]).map((box) => [box.id, box.reason]);
    expect(reasons).toEqual([
      ["ux", undefined],
      ["architecture", undefined],
      ["portal", "Customer portal already depends on Clickable prototype"],
      ["billing", undefined],
      ["reporting", "Reporting already depends on Clickable prototype"],
    ]);
  });

  test("count what is checked against the predecessor limit", () => {
    const all = LIMITS.tasks.find((task) => task.id === "hub")?.dependencies ?? [];
    const full = "Hub already has 50 predecessors, the most a task can have";
    const atLimit = panelBoxes(LIMITS, "hub", all);
    expect(atLimit.filter((box) => box.reason !== undefined).map((box) => box.id)).toEqual([
      "src",
      "x",
    ]);
    expect(atLimit.find((box) => box.id === "x")?.reason).toBe(full);
    const fewer = panelBoxes(LIMITS, "hub", toggled(all, "p50", false));
    expect(fewer.find((box) => box.id === "x")?.reason).toBeUndefined();
    expect(fewer.find((box) => box.id === "p50")).toMatchObject({ checked: false });
  });

  test("refuse a task that already has 50 dependents", () => {
    expect(panelBoxes(LIMITS, "x", []).find((box) => box.id === "src")?.reason).toBe(
      "Source already has 50 dependent tasks, the most a task can have",
    );
  });
});

describe("a box checked or unchecked", () => {
  test("adds the task after those held, or takes it out, keeping each once", () => {
    expect(toggled(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggled(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(toggled(["a", "b"], "a", false)).toEqual(["b"]);
    expect(toggled(["a"], "c", false)).toEqual(["a"]);
  });
});
