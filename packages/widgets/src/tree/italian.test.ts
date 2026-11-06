import { describe, expect, test } from "bun:test";
import type { TreePertProps } from "@askboard/contract";
import { type Say, say } from "@askboard/view/catalog";
import { nameColumnOf } from "./cells.ts";
import { deletedWith } from "./deleting.ts";
import { enterCell, nameTooLong } from "./entry.ts";
import { refusalText } from "./linked.ts";
import { TREE_TOOLS } from "./model/keys.ts";

// Task 1.6 (review F-04): the Tree's chrome speaks the ask's language, from the catalogue.

const WBS: TreePertProps = { columns: [], nodes: [], pert: true };
const IT: Say = (key, slots) => say("it-IT", key, slots);

describe("the Tree in Italian", () => {
  test("the tools carry catalogue names that read in Italian", () => {
    expect(TREE_TOOLS.map(({ label }) => IT(label))).toEqual([
      "Aggiungi nodo",
      "Aggiungi figlio",
      "Sposta su",
      "Sposta giù",
      "Rientra",
      "Riduci rientro",
      "Elimina",
    ]);
  });

  test("the name column, the delete question and the refusals", () => {
    expect(nameColumnOf({ nodes: [] }, IT)).toBe("Nome");
    expect(nameColumnOf(WBS, IT)).toBe("Pacchetto di lavoro");
    expect(deletedWith(3, 2, IT)).toBe(
      "e i 3 nodi sotto verranno eliminati. 2 attività del piano dipendono da essi.",
    );
    expect(nameTooLong("it-IT")).toBe("Un nome contiene al massimo 200 caratteri.");
    const entry = enterCell({ nodes: [{ id: "a", label: "A" }] }, "a", 0, "x".repeat(201), "it-IT");
    expect(entry).toEqual({ kind: "refused", reason: nameTooLong("it-IT") });
    expect(refusalText({ ok: false, limit: "entries", most: 500 }, [], IT)).toBe(
      "Il piano conterrebbe più di 500 attività, il massimo per un piano.",
    );
  });
});
