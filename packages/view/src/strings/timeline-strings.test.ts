import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";

// The Timeline's strings (view-and-widgets spec: LaTeX, Kanban and Timeline strings; ux-update-draft.md
// block 2): in both tables, an Italian board showing them in Italian. The Italian texts are to review.
const KEYS = [
  "timeline.tools",
  "timeline.moveEarlier",
  "timeline.moveLater",
  "timeline.moveToLane",
  "timeline.counterMoved",
  "timeline.entryRange",
  "timeline.entryRangeYears",
  "timeline.entryMilestone",
  "timeline.entryUndated",
  "change.widgetTimeline",
] as const;

describe("the Timeline's strings", () => {
  test("are in both tables", () => {
    for (const key of KEYS) {
      expect(Object.hasOwn(STRINGS["en-US"], key), key).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key), key).toBe(true);
    }
  });

  test("read in English", () => {
    expect(t("en-US", "timeline.tools")).toBe("Timeline tools");
    expect(t("en-US", "timeline.moveEarlier")).toBe("Move earlier");
    expect(t("en-US", "timeline.moveLater")).toBe("Move later");
    expect(t("en-US", "timeline.moveToLane")).toBe("Move to lane…");
    expect(t("en-US", "timeline.counterMoved", { count: 2 })).toBe("Your changes: 2 moved");
    expect(
      t("en-US", "timeline.entryRange", {
        label: "Checkout",
        start: "Jan 5",
        end: "Jan 9",
        year: "2026",
        lane: "Web",
      }),
    ).toBe("Checkout, Jan 5 to Jan 9, 2026, Web");
    expect(
      t("en-US", "timeline.entryRangeYears", {
        label: "Checkout",
        start: "Dec 28",
        startYear: "2026",
        end: "Jan 3",
        endYear: "2027",
        lane: "Web",
      }),
    ).toBe("Checkout, Dec 28, 2026 to Jan 3, 2027, Web");
    expect(
      t("en-US", "timeline.entryMilestone", {
        label: "Launch",
        date: "Mar 2",
        year: "2026",
        lane: "Mobile",
      }),
    ).toBe("Launch, milestone, Mar 2, 2026, Mobile");
    expect(t("en-US", "timeline.entryUndated", { label: "X", lane: "Web" })).toBe("X, Web");
    expect(t("en-US", "change.widgetTimeline")).toBe("Timeline");
  });

  test("read in Italian", () => {
    expect(t("it-IT", "timeline.tools")).toBe("Strumenti della timeline");
    expect(t("it-IT", "timeline.moveEarlier")).toBe("Sposta prima");
    expect(t("it-IT", "timeline.moveLater")).toBe("Sposta dopo");
    expect(t("it-IT", "timeline.moveToLane")).toBe("Sposta nella corsia…");
    expect(t("it-IT", "timeline.counterMoved", { count: 2 })).toBe("Le tue modifiche: 2 spostati");
    expect(t("it-IT", "timeline.counterMoved", { count: 1 })).toBe("Le tue modifiche: 1 spostato");
    expect(
      t("it-IT", "timeline.entryRange", {
        label: "Checkout",
        start: "5 gen",
        end: "9 gen",
        year: "2026",
        lane: "Web",
      }),
    ).toBe("Checkout, dal 5 gen al 9 gen 2026, Web");
    expect(
      t("it-IT", "timeline.entryRangeYears", {
        label: "Checkout",
        start: "28 dic",
        startYear: "2026",
        end: "3 gen",
        endYear: "2027",
        lane: "Web",
      }),
    ).toBe("Checkout, dal 28 dic 2026 al 3 gen 2027, Web");
    expect(
      t("it-IT", "timeline.entryMilestone", {
        label: "Lancio",
        date: "2 mar",
        year: "2026",
        lane: "Mobile",
      }),
    ).toBe("Lancio, traguardo, 2 mar 2026, Mobile");
    expect(t("it-IT", "timeline.entryUndated", { label: "X", lane: "Web" })).toBe("X, Web");
    expect(t("it-IT", "change.widgetTimeline")).toBe("Timeline");
  });
});
