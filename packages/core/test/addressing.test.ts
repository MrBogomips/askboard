import { describe, expect, test } from "bun:test";
import type { Change } from "@askboard/contract";
import { type ExpansionMap, referenceAddressing } from "../src/index.ts";
import { deepFreeze } from "./molecules.ts";

// Reference addressing (molecules design decision 7; core spec, "Answers in reference
// addressing", "Warnings in reference addressing"): whatever names an expanded item names its
// reference instead, keeping the rest of the address or text.

const map: ExpansionMap = new Map([
  ["wbs__tree", deepFreeze({ reference: "wbs", molecule: "wbs-pert", version: "1.0.0" })],
  [
    "schedule__plan",
    deepFreeze({ reference: "schedule", molecule: "gantt-plan", version: "1.0.0" }),
  ],
]);
const addressing = referenceAddressing(map);

describe("toReference", () => {
  test("puts an expanded item's address under its reference's ID, keeping the rest", () => {
    expect(addressing.toReference("wbs__tree.portal.label")).toBe("wbs.portal.label");
    expect(addressing.toReference("schedule__plan.finish")).toBe("schedule.finish");
    expect(addressing.toReference("schedule__plan.u-1.dependencies")).toBe(
      "schedule.u-1.dependencies",
    );
    expect(addressing.toReference("wbs__tree")).toBe("wbs");
  });

  test("leaves every other address as it is", () => {
    for (const address of [
      "erp-export",
      "plan.wbs__tree.label",
      "wbs__treex.portal",
      "wbs",
      "wbs.portal",
      "",
    ]) {
      expect(addressing.toReference(address)).toBe(address);
    }
  });

  test("with an empty map, changes nothing", () => {
    const none = referenceAddressing(new Map());
    expect(none.toReference("wbs__tree.portal")).toBe("wbs__tree.portal");
    expect(none.textToReference("the item wbs__tree")).toBe("the item wbs__tree");
  });
});

describe("an answer's changes", () => {
  const changes: readonly Change[] = deepFreeze([
    { op: "set", target: "wbs__tree.portal.label", value: "Customer portal: accounts" },
    {
      op: "add",
      target: "wbs__tree.u-1",
      parent: "build",
      after: "portal",
      value: { label: "Customer portal: dashboards", optimistic: 4 },
    },
    { op: "move", target: "wbs__tree.billing", parent: "wbs__tree", after: "schedule__plan" },
    { op: "remove", target: "wbs__tree.reporting" },
    { op: "set", target: "schedule__plan.u-1.dependencies", value: ["architecture", "prototype"] },
    { op: "set", target: "notes.text", value: "wbs__tree" },
  ]);

  test("each target names the reference; parent, after and values stay (F3)", () => {
    const mapped = addressing.changes(changes);
    expect(mapped).toEqual([
      { op: "set", target: "wbs.portal.label", value: "Customer portal: accounts" },
      {
        op: "add",
        target: "wbs.u-1",
        parent: "build",
        after: "portal",
        value: { label: "Customer portal: dashboards", optimistic: 4 },
      },
      { op: "move", target: "wbs.billing", parent: "wbs__tree", after: "schedule__plan" },
      { op: "remove", target: "wbs.reporting" },
      { op: "set", target: "schedule.u-1.dependencies", value: ["architecture", "prototype"] },
      { op: "set", target: "notes.text", value: "wbs__tree" },
    ]);
    expect(mapped[1]).not.toBe(changes[1]);
    expect((mapped[1] as { value: unknown }).value).toBe((changes[1] as { value: unknown }).value);
  });

  test("an address of an item no reference expanded keeps its target", () => {
    const plain: Change = { op: "set", target: "wbs.portal.label", value: "x" };
    expect(addressing.changes([plain])).toEqual([plain]);
  });
});

describe("an answer's derived values", () => {
  test("each key names the reference; the values are untouched", () => {
    const criticalPath = ["ux", "prototype", "portal", "reporting"];
    const derived = deepFreeze({
      "wbs__tree.ux.expected": 4.83,
      "wbs__tree.expected": 42,
      "schedule__plan.finish": "2026-12-02",
      "schedule__plan.criticalPath": criticalPath,
      "other.total": 3,
    });
    const mapped = addressing.derived(derived);
    expect(mapped).toEqual({
      "wbs.ux.expected": 4.83,
      "wbs.expected": 42,
      "schedule.finish": "2026-12-02",
      "schedule.criticalPath": criticalPath,
      "other.total": 3,
    });
    expect(mapped["schedule.criticalPath"]).toBe(criticalPath);
    expect(Object.keys(mapped)).toEqual([
      "wbs.ux.expected",
      "wbs.expected",
      "schedule.finish",
      "schedule.criticalPath",
      "other.total",
    ]);
  });
});

describe("warnings and problems", () => {
  test("a missing-reference warning naming schedule__plan and review names schedule and review", () => {
    const warning = deepFreeze({
      error: "missing-reference",
      address: "schedule__plan.review",
      detail: "the dependencies name review, which is no task of the plan",
    });
    expect(addressing.warning(warning)).toEqual({
      error: "missing-reference",
      address: "schedule.review",
      detail: "the dependencies name review, which is no task of the plan",
    });
  });

  test("an expanded ID anywhere in a text names the reference, as a whole ID only", () => {
    const warning = {
      error: "missing-reference",
      address: "schedule__plan.workPackages",
      detail: "the work packages wbs__tree name no WBS-with-PERT item; wbs__treex is not one",
    };
    expect(addressing.warning(warning)).toEqual({
      error: "missing-reference",
      address: "schedule.workPackages",
      detail: "the work packages wbs name no WBS-with-PERT item; wbs__treex is not one",
    });
  });

  test("a problem's item ID, address fields and texts name the reference, keeping the rest", () => {
    const problem = deepFreeze({
      itemId: "schedule__plan",
      path: "/props/workPackages",
      field: "props.workPackages",
      message: 'the Gantt plan "schedule__plan" names "wbs__tree", which is not in its question',
      target: "wbs__tree.portal",
      also: ["schedule__plan.finish", { nested: "in wbs__tree" }],
    });
    expect(addressing.warning(problem)).toEqual({
      itemId: "schedule",
      path: "/props/workPackages",
      field: "props.workPackages",
      message: 'the Gantt plan "schedule" names "wbs", which is not in its question',
      target: "wbs.portal",
      also: ["schedule.finish", { nested: "in wbs" }],
    });
  });

  test("an address field keeps a child ID that happens to equal an expanded ID", () => {
    const warning = { address: "plan.wbs__tree", detail: "x" };
    expect(addressing.warning(warning).address).toBe("plan.wbs__tree");
  });

  test("values that are no text stay as they are", () => {
    const warning = { address: "schedule__plan.finish", count: 2, ok: false, none: null };
    expect(addressing.warning(warning)).toEqual({
      address: "schedule.finish",
      count: 2,
      ok: false,
      none: null,
    });
  });
});
