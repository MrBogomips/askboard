import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";

// The Kanban's strings (view-and-widgets spec: LaTeX, Kanban and Timeline strings; ux-update-draft.md
// block 2): in both tables, an Italian board showing them in Italian. The Italian texts are to review.
const KEYS = [
  "kanban.tools",
  "kanban.moveTo",
  "kanban.moveUp",
  "kanban.moveDown",
  "kanban.toTop",
  "kanban.toBottom",
  "kanban.columnName",
  "kanban.cardName",
  "kanban.counterMoved",
  "change.widgetKanban",
] as const;

describe("the Kanban's strings", () => {
  test("are in both tables", () => {
    for (const key of KEYS) {
      expect(Object.hasOwn(STRINGS["en-US"], key), key).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key), key).toBe(true);
    }
  });

  test("read in English", () => {
    expect(t("en-US", "kanban.tools")).toBe("Kanban tools");
    expect(t("en-US", "kanban.moveTo")).toBe("Move to…");
    expect(t("en-US", "kanban.moveUp")).toBe("Move up");
    expect(t("en-US", "kanban.moveDown")).toBe("Move down");
    expect(t("en-US", "kanban.toTop")).toBe("To top");
    expect(t("en-US", "kanban.toBottom")).toBe("To bottom");
    expect(t("en-US", "kanban.columnName", { label: "To do", count: 2 })).toBe("To do, 2 cards");
    expect(t("en-US", "kanban.columnName", { label: "To do", count: 1 })).toBe("To do, 1 card");
    expect(t("en-US", "kanban.cardName", { label: "Fix login", column: "To do" })).toBe(
      "Fix login, in To do",
    );
    expect(t("en-US", "kanban.counterMoved", { count: 2 })).toBe("Your changes: 2 moved");
    expect(t("en-US", "change.widgetKanban")).toBe("Kanban");
  });

  test("read in Italian", () => {
    expect(t("it-IT", "kanban.tools")).toBe("Strumenti del Kanban");
    expect(t("it-IT", "kanban.moveTo")).toBe("Sposta in…");
    expect(t("it-IT", "kanban.moveUp")).toBe("Sposta su");
    expect(t("it-IT", "kanban.moveDown")).toBe("Sposta giù");
    expect(t("it-IT", "kanban.toTop")).toBe("In cima");
    expect(t("it-IT", "kanban.toBottom")).toBe("In fondo");
    expect(t("it-IT", "kanban.columnName", { label: "Da fare", count: 2 })).toBe(
      "Da fare, 2 schede",
    );
    expect(t("it-IT", "kanban.columnName", { label: "Da fare", count: 1 })).toBe(
      "Da fare, 1 scheda",
    );
    expect(t("it-IT", "kanban.cardName", { label: "Correggi il login", column: "Da fare" })).toBe(
      "Correggi il login, in Da fare",
    );
    expect(t("it-IT", "kanban.counterMoved", { count: 2 })).toBe("Le tue modifiche: 2 spostate");
    expect(t("it-IT", "kanban.counterMoved", { count: 1 })).toBe("Le tue modifiche: 1 spostata");
    expect(t("it-IT", "change.widgetKanban")).toBe("Kanban");
  });
});
