import { describe, expect, test } from "bun:test";
import { formatFor } from "../en-us.ts";
import { startEntry } from "./entries.ts";
import { scheduleNote } from "./notes.ts";

// Task 1.6 (review F-04): the Gantt's model words its messages from the catalogue in the ask's
// language; the English stays as it was.
const italian = formatFor("it-IT", "it-IT");
const say = italian.text;
const row = { id: "a", label: "A", dependencies: ["ghost"] } as never;
const broken = {
  kind: "error",
  error: { error: "missing-reference", address: "g.a.startDate" },
} as never;

describe("the Gantt's messages in Italian", () => {
  test("a note under a task the graph could not schedule", () => {
    expect(scheduleNote("g", row, broken, new Map([["a", "A"]]), say)).toBe(
      "Nessuna data: il predecessore ghost non indica nessuna attività.",
    );
  });

  test("a refused start names the non-working day in Italian", () => {
    const sent = { tasks: [{ id: "a", label: "A", duration: 1 }] } as never;
    const entry = startEntry(sent, sent, "a", undefined, "05/12/2026", italian);
    expect(entry.kind === "refused" && entry.reason).toContain("non è un giorno lavorativo");
  });
});
