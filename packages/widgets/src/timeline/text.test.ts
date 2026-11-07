import { describe, expect, test } from "bun:test";
import type { TimelineEntry } from "@askboard/contract";
import { type Say, say } from "@askboard/view/catalog";
import { counterText, entryName, laneText, shownLabel } from "./text.ts";

// The Timeline's counter, names and cut labels (view-and-widgets spec: Timeline layout, Timeline at
// the keyboard; ux-update-draft block 2): an entry's name holds its label whole, its dates in the
// ask's locale and its lane; a lane label and an entry label are cut with an ellipsis.
const EN: Say = (key, slots) => say("en-US", key, slots);
const IT: Say = (key, slots) => say("it-IT", key, slots);

const range: TimelineEntry = {
  id: "checkout",
  label: "Checkout",
  lane: "web",
  start: "2026-01-05",
  end: "2026-01-09",
};
const milestone: TimelineEntry = {
  id: "launch",
  label: "Launch",
  lane: "mobile",
  date: "2026-03-02",
};

describe("counterText", () => {
  test("reads No changes while no entry moved, else counts them", () => {
    expect(counterText(0, EN)).toBe("No changes");
    expect(counterText(0, IT)).toBe("Nessuna modifica");
    expect(counterText(1, EN)).toBe("Your changes: 1 moved");
    expect(counterText(2, IT)).toBe("Le tue modifiche: 2 spostati");
    expect(counterText(1, IT)).toBe("Le tue modifiche: 1 spostato");
  });
});

describe("entryName", () => {
  test("a range reads its dates and lane, in the ask's locale", () => {
    expect(entryName(range, "Web", "en-US", EN)).toBe("Checkout, Jan 5 to Jan 9, 2026, Web");
    expect(entryName({ ...range, label: "Checkout" }, "Web", "it-IT", IT)).toBe(
      "Checkout, dal 5 gen al 9 gen 2026, Web",
    );
  });

  test("a milestone reads milestone, its date and its lane", () => {
    expect(entryName(milestone, "Mobile", "en-US", EN)).toBe(
      "Launch, milestone, Mar 2, 2026, Mobile",
    );
    expect(entryName({ ...milestone, label: "Lancio" }, "Mobile", "it-IT", IT)).toBe(
      "Lancio, traguardo, 2 mar 2026, Mobile",
    );
  });

  test("a range across years names both years", () => {
    const across = { ...range, start: "2026-12-28", end: "2027-01-03" };
    expect(entryName(across, "Web", "en-US", EN)).toBe(
      "Checkout, Dec 28, 2026 to Jan 3, 2027, Web",
    );
    expect(entryName(across, "Web", "it-IT", IT)).toBe(
      "Checkout, dal 28 dic 2026 al 3 gen 2027, Web",
    );
  });

  test("holds a long label whole", () => {
    const label = "L".repeat(200);
    expect(entryName({ ...milestone, label }, "Mobile", "en-US", EN)).toStartWith(
      `${label}, milestone`,
    );
  });

  test("an entry with no day reads its label and lane", () => {
    const bare: TimelineEntry = { id: "x", label: "X", lane: "web" };
    expect(entryName(bare, "Web", "en-US", EN)).toBe("X, Web");
  });
});

describe("shownLabel and laneText", () => {
  test("a label of 28 characters or fewer shows whole, a longer one is cut with an ellipsis", () => {
    expect(shownLabel("a".repeat(28))).toBe("a".repeat(28));
    expect(shownLabel("a".repeat(29))).toBe(`${"a".repeat(27)}…`);
  });

  test("counts code points, not UTF-16 units", () => {
    const label = "😀".repeat(40);
    expect(shownLabel(label)).toBe(`${"😀".repeat(27)}…`);
  });

  test("a lane label of 14 characters or fewer shows whole, a longer one is cut with an ellipsis", () => {
    expect(laneText("a".repeat(14))).toBe("a".repeat(14));
    expect(laneText("a".repeat(15))).toBe(`${"a".repeat(13)}…`);
  });
});
