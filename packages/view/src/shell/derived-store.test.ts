import { describe, expect, test } from "bun:test";
import { createDerivedStore } from "./derived-store.ts";

describe("the derived values each item last reported (gantt-widget design decision 10)", () => {
  test("an item has reported nothing until it reports", () => {
    expect(createDerivedStore().reported("release")).toBeUndefined();
  });

  test("a report is kept as a frozen copy: a later change to the caller's object does not reach it", () => {
    const derived = createDerivedStore();
    const values: Record<string, unknown> = { "release.finish": "2026-12-11" };
    derived.report("release", values);
    values["release.finish"] = "2027-01-01";
    expect(derived.reported("release")).toEqual({ "release.finish": "2026-12-11" });
    expect(Object.isFrozen(derived.reported("release"))).toBe(true);
  });

  test("each report replaces the item's last one, and leaves the other items' alone", () => {
    const derived = createDerivedStore();
    derived.report("release", {
      "release.finish": "2026-12-11",
      "release.criticalPath": ["ux", "prototype", "portal", "reporting"],
    });
    derived.report("other", { "other.finish": "2026-11-20" });
    derived.report("release", { "release.finish": "2026-12-16" });
    expect(derived.reported("release")).toEqual({ "release.finish": "2026-12-16" });
    expect(derived.reported("other")).toEqual({ "other.finish": "2026-11-20" });
  });

  test("an empty report leaves the item with no derived value", () => {
    const derived = createDerivedStore();
    derived.report("release", { "release.finish": "2026-12-11" });
    derived.report("release", {});
    expect(derived.reported("release")).toBeUndefined();
  });

  test("any item ID and any reference is a plain key, __proto__ included", () => {
    const derived = createDerivedStore();
    const values = JSON.parse('{"__proto__": 1, "constructor.finish": 2}');
    derived.report("__proto__", values);
    expect(derived.reported("__proto__")).toEqual(values);
    expect(Object.hasOwn(derived.reported("__proto__") ?? {}, "__proto__")).toBe(true);
    expect(derived.reported("constructor")).toBeUndefined();
  });
});
