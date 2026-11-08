import { describe, expect, test } from "bun:test";
import { type Say, say } from "@askboard/view/catalog";
import { type GroupQuestion, groupedWith } from "./grouping.ts";

// The group question's words (view spec, The group question's words; proposal, open question 5):
// the sentence after the leaf's name, from the catalogs.
const EN: Say = (key, slots) => say("en-US", key, slots);
const IT: Say = (key, slots) => say("it-IT", key, slots);

const PORTAL: GroupQuestion = {
  label: "Customer portal",
  estimates: true,
  task: true,
  dependents: 1,
};

describe("what the group question says after the leaf's name", () => {
  test("the portal: its estimates and its task leave, and one task depends on it", () => {
    expect(groupedWith(PORTAL, EN)).toBe(
      "becomes a group: its estimates leave the totals while it has children, and its task leaves the plan. 1 task in the plan depends on it.",
    );
  });

  test("a work breakdown no plan names says the estimates leave the totals and nothing of a plan", () => {
    const words = groupedWith({ ...PORTAL, task: false, dependents: 0 }, EN);
    expect(words).toBe("becomes a group: its estimates leave the totals while it has children.");
    expect(words).not.toContain("plan");
  });

  test("a leaf with no estimate under a plan says its task leaves the plan", () => {
    expect(groupedWith({ ...PORTAL, estimates: false, dependents: 0 }, EN)).toBe(
      "becomes a group: its task leaves the plan.",
    );
  });

  test("counts the dependents in the plural", () => {
    expect(groupedWith({ ...PORTAL, dependents: 3 }, EN)).toEndWith(
      " 3 tasks in the plan depend on it.",
    );
  });

  test("the Italian texts", () => {
    expect(groupedWith(PORTAL, IT)).toBe(
      "diventa un gruppo: le sue stime escono dai totali finché ha figli, e la sua attività esce dal piano. 1 attività del piano dipende da esso.",
    );
    expect(groupedWith({ ...PORTAL, task: false, dependents: 0 }, IT)).toBe(
      "diventa un gruppo: le sue stime escono dai totali finché ha figli.",
    );
    expect(groupedWith({ ...PORTAL, estimates: false, dependents: 0 }, IT)).toBe(
      "diventa un gruppo: la sua attività esce dal piano.",
    );
  });

  test("the buttons", () => {
    expect([EN("tree.group.cancel"), EN("tree.group.continue")]).toEqual(["Cancel", "Continue"]);
    expect([IT("tree.group.cancel"), IT("tree.group.continue")]).toEqual(["Annulla", "Continua"]);
  });
});
