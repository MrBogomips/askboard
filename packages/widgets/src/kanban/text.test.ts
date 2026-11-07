import { describe, expect, test } from "bun:test";
import { type Say, say } from "@askboard/view/catalog";
import { cardName, columnName, counterText } from "./text.ts";

// The Kanban's counter and names (view-and-widgets spec: Kanban at the keyboard; ux-update-draft
// block 2): "No changes" or "Your changes: N moved", a card named by its column, a column by its
// count of cards.
const EN: Say = (key, slots) => say("en-US", key, slots);
const IT: Say = (key, slots) => say("it-IT", key, slots);

describe("counterText", () => {
  test("reads No changes while no card moved", () => {
    expect(counterText(0, EN)).toBe("No changes");
    expect(counterText(0, IT)).toBe("Nessuna modifica");
  });

  test("counts the moved cards", () => {
    expect(counterText(1, EN)).toBe("Your changes: 1 moved");
    expect(counterText(2, IT)).toBe("Le tue modifiche: 2 spostate");
  });
});

describe("cardName and columnName", () => {
  test("a card is named with its column, a column with its cards", () => {
    expect(cardName("Fix login", "To do", EN)).toBe("Fix login, in To do");
    expect(columnName("To do", 2, EN)).toBe("To do, 2 cards");
    expect(columnName("Da fare", 1, IT)).toBe("Da fare, 1 scheda");
  });
});
