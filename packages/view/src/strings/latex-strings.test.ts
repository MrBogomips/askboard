import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";

// The LaTeX's strings (view-and-widgets spec: LaTeX, Kanban and Timeline strings; LaTeX parse
// errors, "A failure with no message"; LaTeX bounded work; ux-update-draft.md
// block 2): in both tables, an Italian board showing them in Italian. The Italian texts are to review.
const KEYS = [
  "latex.source",
  "latex.preview",
  "latex.parseError",
  "latex.drawFailed",
  "latex.macroDefinition",
  "latex.internalCommand",
  "latex.refusedCommand",
  "latex.tooDeep",
  "latex.counterEdited",
  "change.widgetLatex",
] as const;

describe("the LaTeX's strings", () => {
  test("are in both tables", () => {
    for (const key of KEYS) {
      expect(Object.hasOwn(STRINGS["en-US"], key), key).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key), key).toBe(true);
    }
  });

  test("read in English", () => {
    expect(t("en-US", "latex.source")).toBe("LaTeX source");
    expect(t("en-US", "latex.preview")).toBe("Preview");
    expect(t("en-US", "latex.parseError", { message: "bad" })).toBe(
      "This expression does not render: bad",
    );
    expect(t("en-US", "latex.drawFailed")).toBe("The expression could not be drawn.");
    expect(t("en-US", "latex.macroDefinition", { command: "\\def" })).toBe(
      "This expression defines a macro with \\def, which a LaTeX item does not allow. Remove it before you answer.",
    );
    expect(t("en-US", "latex.internalCommand", { command: "\\current@color" })).toBe(
      "This expression uses \\current@color, one of KaTeX's internal commands, which a LaTeX item does not allow. Remove it before you answer.",
    );
    expect(t("en-US", "latex.refusedCommand", { command: "\\show" })).toBe(
      "This expression uses \\show, which a LaTeX item does not allow. Remove it before you answer.",
    );
    expect(t("en-US", "latex.tooDeep", { depth: 12, limit: 11 })).toBe(
      "This expression nests 12 levels deep, more than the limit of 11. Simplify it before you answer.",
    );
    expect(t("en-US", "latex.counterEdited")).toBe("Your changes: expression edited");
    expect(t("en-US", "change.widgetLatex")).toBe("LaTeX");
  });

  test("read in Italian", () => {
    expect(t("it-IT", "latex.source")).toBe("Sorgente LaTeX");
    expect(t("it-IT", "latex.preview")).toBe("Anteprima");
    expect(t("it-IT", "latex.parseError", { message: "bad" })).toBe(
      "Questa espressione non si visualizza: bad",
    );
    expect(t("it-IT", "latex.drawFailed")).toBe("Non è stato possibile disegnare l'espressione.");
    expect(t("it-IT", "latex.macroDefinition", { command: "\\def" })).toBe(
      "Questa espressione definisce una macro con \\def, che un elemento LaTeX non ammette. Rimuovila prima di rispondere.",
    );
    expect(t("it-IT", "latex.internalCommand", { command: "\\current@color" })).toBe(
      "Questa espressione usa \\current@color, uno dei comandi interni di KaTeX, che un elemento LaTeX non ammette. Rimuovilo prima di rispondere.",
    );
    expect(t("it-IT", "latex.refusedCommand", { command: "\\show" })).toBe(
      "Questa espressione usa \\show, che un elemento LaTeX non consente. Rimuovilo prima di rispondere.",
    );
    expect(t("it-IT", "latex.tooDeep", { depth: 12, limit: 11 })).toBe(
      "Questa espressione ha 12 livelli di annidamento, oltre il limite di 11. Semplificala prima di rispondere.",
    );
    expect(t("it-IT", "latex.counterEdited")).toBe("Le tue modifiche: espressione modificata");
    expect(t("it-IT", "change.widgetLatex")).toBe("LaTeX");
  });
});
