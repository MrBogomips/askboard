import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";

// The Ranking's strings (view-and-widgets spec: The three widgets' strings; ux-update-draft.md
// block 2): in both tables, an Italian board showing them in Italian.
describe("the Ranking's strings", () => {
  test("are in both tables", () => {
    for (const key of [
      "ranking.moveUp",
      "ranking.moveDown",
      "ranking.keep",
      "ranking.tools",
      "ranking.handle",
      "ranking.counterKept",
      "ranking.counterMoved",
      "change.widgetRanking",
    ]) {
      expect(Object.hasOwn(STRINGS["en-US"], key)).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key)).toBe(true);
    }
  });

  test("read in English", () => {
    expect(t("en-US", "ranking.moveUp")).toBe("Move up");
    expect(t("en-US", "ranking.moveDown")).toBe("Move down");
    expect(t("en-US", "ranking.keep")).toBe("Keep this order");
    expect(t("en-US", "ranking.handle", { name: "Alpha" })).toBe("Drag Alpha");
    expect(t("en-US", "ranking.counterKept")).toBe("Order kept");
    expect(t("en-US", "ranking.counterMoved", { count: 2 })).toBe("Your changes: 2 moved");
    expect(t("en-US", "change.widgetRanking")).toBe("Ranking");
  });

  test("read in Italian", () => {
    expect(t("it-IT", "ranking.moveUp")).toBe("Sposta su");
    expect(t("it-IT", "ranking.moveDown")).toBe("Sposta giù");
    expect(t("it-IT", "ranking.keep")).toBe("Mantieni quest'ordine");
    expect(t("it-IT", "ranking.handle", { name: "Alfa" })).toBe("Trascina Alfa");
    expect(t("it-IT", "ranking.counterKept")).toBe("Ordine mantenuto");
    expect(t("it-IT", "ranking.counterMoved", { count: 2 })).toBe("Le tue modifiche: 2 spostati");
    expect(t("it-IT", "change.widgetRanking")).toBe("Classifica");
  });
});
