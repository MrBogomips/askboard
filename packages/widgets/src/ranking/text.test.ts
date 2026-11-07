import { describe, expect, test } from "bun:test";
import { type Say, say } from "@askboard/view/catalog";
import { counterText } from "./text.ts";

// The toolbar's counter (view-and-widgets spec: Ranking at the keyboard; ux-update-draft block 2):
// "No changes" until the user gives an order, "Order kept" for the order as sent, "Your changes: N
// moved" otherwise.
const EN: Say = (key, slots) => say("en-US", key, slots);
const IT: Say = (key, slots) => say("it-IT", key, slots);

describe("counterText", () => {
  test("reads No changes while no order is held", () => {
    expect(counterText(false, 0, EN)).toBe("No changes");
    expect(counterText(false, 0, IT)).toBe("Nessuna modifica");
  });

  test("reads Order kept for a held order with no row moved", () => {
    expect(counterText(true, 0, EN)).toBe("Order kept");
    expect(counterText(true, 0, IT)).toBe("Ordine mantenuto");
  });

  test("counts the moved rows", () => {
    expect(counterText(true, 3, EN)).toBe("Your changes: 3 moved");
    expect(counterText(true, 1, EN)).toBe("Your changes: 1 moved");
    expect(counterText(true, 2, IT)).toBe("Le tue modifiche: 2 spostati");
    expect(counterText(true, 1, IT)).toBe("Le tue modifiche: 1 spostato");
  });
});
