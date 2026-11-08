import { describe, expect, test } from "bun:test";
import { FORMULA_ERROR_KINDS, type FormulaErrorKind } from "@askboard/contract";
import { STRINGS, t } from "./index.ts";
import { STRING_KEYS, type StringKey } from "./keys.ts";

// The Table's strings (view-and-widgets spec: Table strings; ux-update-draft.md block 1): the
// toolbar and its name, the counter, the Total row's and the computed mark's words, an on/off cell's
// three states, a cell's name, the refusal at the limit, each formula problem and the empty formula
// cell, each in both tables, an Italian board showing them in Italian (the Italian texts are marked
// to review in the table, as the draft marks them). The name in the agent-change notice is the
// Table's own.

const KEYS: readonly StringKey[] = [
  "table.toolbar",
  "table.addRow",
  "table.deleteRow",
  "table.noChanges",
  "table.changes",
  "table.total",
  "table.computed",
  "table.on",
  "table.off",
  "table.notSet",
  "table.cellName",
  "table.maxRows",
  "table.noValue",
  "table.problem.syntax",
  "table.problem.overLimit",
  "table.problem.notWhitelisted",
  "table.problem.missingReference",
  "table.problem.cycle",
  "table.problem.mixedCurrencies",
  "table.problem.value",
  "table.problem.divisionByZero",
  "change.widgetTable",
];

// The key of a formula-error kind: `table.problem.` and the kind in camel case.
const problemKey = (kind: FormulaErrorKind): StringKey => {
  const name = kind.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
  return `table.problem.${name}` as StringKey;
};

describe("the Table's strings", () => {
  test("are in both tables, each key listed once", () => {
    for (const key of KEYS) {
      expect(Object.hasOwn(STRINGS["en-US"], key), key).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key), key).toBe(true);
    }
    expect(STRING_KEYS.filter((key) => key.startsWith("table.")).sort()).toEqual(
      KEYS.filter((key) => key.startsWith("table.")).sort(),
    );
  });

  test("read in English", () => {
    expect(t("en-US", "table.toolbar")).toBe("Table tools");
    expect(t("en-US", "table.addRow")).toBe("Add row");
    expect(t("en-US", "table.deleteRow")).toBe("Delete row");
    expect(t("en-US", "table.noChanges")).toBe("No changes");
    expect(t("en-US", "table.changes", { count: 3 })).toBe("Your changes: 3");
    expect(t("en-US", "table.changes", { count: 1 })).toBe("Your changes: 1");
    expect(t("en-US", "table.total")).toBe("Total");
    expect(t("en-US", "table.computed")).toBe("Computed");
    expect(t("en-US", "table.on")).toBe("On");
    expect(t("en-US", "table.off")).toBe("Off");
    expect(t("en-US", "table.notSet")).toBe("Not set");
    expect(t("en-US", "table.cellName", { column: "Rate", row: 2 })).toBe("Rate, row 2");
    expect(t("en-US", "table.maxRows", { max: 200 })).toBe("A table holds at most 200 rows.");
    expect(t("en-US", "table.noValue")).toBe("—");
    expect(t("en-US", "change.widgetTable")).toBe("Table");
  });

  test("read in Italian", () => {
    expect(t("it-IT", "table.toolbar")).toBe("Strumenti della tabella");
    expect(t("it-IT", "table.addRow")).toBe("Aggiungi riga");
    expect(t("it-IT", "table.deleteRow")).toBe("Elimina riga");
    expect(t("it-IT", "table.noChanges")).toBe("Nessuna modifica");
    expect(t("it-IT", "table.changes", { count: 3 })).toBe("Le tue modifiche: 3");
    expect(t("it-IT", "table.total")).toBe("Totale");
    expect(t("it-IT", "table.computed")).toBe("Calcolata");
    expect(t("it-IT", "table.on")).toBe("Sì");
    expect(t("it-IT", "table.off")).toBe("No");
    expect(t("it-IT", "table.notSet")).toBe("Non impostato");
    expect(t("it-IT", "table.cellName", { column: "Tariffa", row: 2 })).toBe("Tariffa, riga 2");
    expect(t("it-IT", "table.maxRows", { max: 200 })).toBe(
      "Una tabella contiene al massimo 200 righe.",
    );
    expect(t("it-IT", "table.noValue")).toBe("—");
    expect(t("it-IT", "change.widgetTable")).toBe("Tabella");
  });

  test("each formula problem reads as the draft words it, in both languages", () => {
    const english: Record<FormulaErrorKind, string> = {
      syntax: "Amount: the formula cannot be read.",
      "not-whitelisted": "Amount: the formula uses a function AskBoard does not offer.",
      "over-limit": "Amount: the formula is too long or reads more than one field at a time.",
      "missing-reference": "Amount: the formula reads a field or an item that does not exist.",
      cycle: "Amount: the formula depends on itself.",
      "mixed-currencies": "Amount: the formula mixes currencies.",
      value: "Amount: a value of the wrong kind.",
      "division-by-zero": "Amount: division by zero.",
    };
    const italian: Record<FormulaErrorKind, string> = {
      syntax: "Importo: la formula non si legge.",
      "not-whitelisted": "Importo: la formula usa una funzione che AskBoard non offre.",
      "over-limit": "Importo: la formula è troppo lunga o legge più di un campo alla volta.",
      "missing-reference": "Importo: la formula legge un campo o un elemento che non esiste.",
      cycle: "Importo: la formula dipende da sé stessa.",
      "mixed-currencies": "Importo: la formula mescola valute.",
      value: "Importo: un valore del tipo sbagliato.",
      "division-by-zero": "Importo: divisione per zero.",
    };
    for (const kind of FORMULA_ERROR_KINDS) {
      expect(t("en-US", problemKey(kind), { column: "Amount" }), kind).toBe(english[kind]);
      expect(t("it-IT", problemKey(kind), { column: "Importo" }), kind).toBe(italian[kind]);
    }
  });

  test("every formula-error kind of the contract has a string in both tables", () => {
    for (const kind of FORMULA_ERROR_KINDS) {
      const key = problemKey(kind);
      expect(Object.hasOwn(STRINGS["en-US"], key), `${kind} in en-US`).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key), `${kind} in it-IT`).toBe(true);
    }
    // And no problem string stands for a kind the contract does not have.
    const known = new Set<string>(FORMULA_ERROR_KINDS.map(problemKey));
    for (const key of STRING_KEYS.filter((each) => each.startsWith("table.problem."))) {
      expect(known.has(key), key).toBe(true);
    }
  });

  test("a column's name goes in as text: markup and slots in it stay as they are", () => {
    expect(t("en-US", "table.problem.cycle", { column: "<b>{row}</b>" })).toBe(
      "<b>{row}</b>: the formula depends on itself.",
    );
  });

  test("the Italian texts stand marked to review where the keys are listed", async () => {
    const keys = await Bun.file(`${import.meta.dir}/keys.ts`).text();
    const italian = await Bun.file(`${import.meta.dir}/it-IT.ts`).text();
    expect(keys).toMatch(/The Table \(table-widget[^\n]*texts to review/);
    expect(italian).toMatch(/The Table \(table-widget[^\n]*to review/);
  });
});
