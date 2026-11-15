import { describe, expect, test } from "bun:test";
import { EN_US } from "./en-US.ts";
import { t } from "./index.ts";
import { IT_IT } from "./it-IT.ts";
import { STRING_KEYS, type StringKey } from "./keys.ts";

// The new strings of the guided flow (answering-flow-guidance, design decision 5; FR-34): the
// report's §4 wording where the PO accepted it, the PO's answers to Q1 to Q3 (task 0.1) for the
// rest. A count form picks by `count`: where the Italian wording changes with the postponed
// number, that number is the `count` slot.
type Case = [StringKey, Record<string, string | number>, string, string];

const CASES: readonly Case[] = [
  ["bar.submitName", {}, "Send answers", "Invia le risposte"],
  ["bar.submitPlain", {}, "Send", "Invia"],
  ["question.confirm", {}, "Confirm", "Conferma"],
  ["question.edit", {}, "Edit", "Modifica"],
  ["question.sendNote", {}, "Send the note", "Invia la nota"],
  ["question.sendChange", {}, "Send the change", "Invia la modifica"],
  ["question.noteSentAt", { time: "10:42" }, "Note sent 10:42", "Nota inviata 10:42"],
  ["mark.draft", {}, "Draft", "Bozza"],
  [
    "header.openPostponed",
    { open: 4, count: 1 },
    "4 to do (1 postponed)",
    "4 da fare (di cui 1 rimandata)",
  ],
  [
    "header.openPostponed",
    { open: 5, count: 2 },
    "5 to do (2 postponed)",
    "5 da fare (di cui 2 rimandate)",
  ],
  ["bar.undoPrefill", {}, "Undo", "Annulla"],
  ["footer.next", { title: "Release" }, "Next: Release", "Prossima: Release"],
  ["footer.continue", {}, "Continue", "Continua"],
  ["footer.newFromAgent", {}, "New from the agent", "Nuova dall'agente"],
  ["completion.title", {}, "Every question has an answer.", "Tutte le domande hanno una risposta."],
  [
    "completion.counts",
    { s: 5, d: 3 },
    "5 sent, 3 delivered to the agent.",
    "5 inviate, 3 consegnate all'agente.",
  ],
  [
    "completion.postponed",
    { count: 1 },
    "1 postponed question remains. Closing loses this ask.",
    "Resta 1 rimandata. Chiudendo perdi questa richiesta.",
  ],
  [
    "completion.postponed",
    { count: 3 },
    "3 postponed questions remain. Closing loses this ask.",
    "Restano 3 rimandate. Chiudendo perdi questa richiesta.",
  ],
  ["completion.goToFirst", {}, "Go to the first", "Vai alla prima"],
  [
    "bar.allReady",
    {},
    "All ready: nothing has been sent yet.",
    "Tutte pronte: niente è stato ancora inviato.",
  ],
  ["areas.done", {}, "completed", "completata"],
  ["settings.afterAnswer", {}, "After answering", "Dopo la risposta"],
  ["settings.goToNext", {}, "Go to the next", "Vai alla prossima"],
  ["settings.stayHere", {}, "Stay here", "Resta qui"],
  [
    "status.next",
    { title: "Release", n: 4, m: 9 },
    "Next: Release, 4 of 9.",
    "Prossima: Release, 4 di 9.",
  ],
  ["status.postponed", {}, "Postponed.", "Rimandata."],
  ["status.declined", {}, "Declined.", "Rifiutata."],
  ["status.changeSent", {}, "Change sent.", "Modifica inviata."],
  [
    "status.readyLost",
    { label: "Ticket" },
    "No longer ready: correct Ticket.",
    "Non più pronta: correggi Ticket.",
  ],
  [
    "status.delivered",
    { d: 2, s: 5 },
    "Delivered to the agent: 2 of 5.",
    "Consegnate all'agente: 2 di 5.",
  ],
  ["status.prefillUndone", {}, "Prefill undone.", "Precompilazione annullata."],
  [
    "status.areaDone",
    { area: "Architecture" },
    "Architecture completed",
    "Architecture completata",
  ],
];

// The two counted keys with a count form: both languages hold `one` and `other`, `other` with {count}.
const COUNTED: readonly StringKey[] = ["header.openPostponed", "completion.postponed"];

describe("the new strings of the guided flow", () => {
  test.each(CASES)("%s %j in both languages", (key, slots, english, italian) => {
    expect(t("en-US", key, slots)).toBe(english);
    expect(t("it-IT", key, slots)).toBe(italian);
  });

  test("each new key is in the typed keys and in both tables", () => {
    for (const key of new Set(CASES.map(([each]) => each))) {
      expect(STRING_KEYS).toContain(key);
      expect(Object.hasOwn(EN_US, key)).toBe(true);
      expect(Object.hasOwn(IT_IT, key)).toBe(true);
    }
  });

  test("the counted keys have both forms, `other` holding {count}", () => {
    for (const key of COUNTED) {
      for (const table of [EN_US, IT_IT]) {
        const value = table[key];
        expect(typeof value).toBe("object");
        if (typeof value === "string") continue;
        expect(value.other).toContain("{count}");
        expect(value.one).toContain("{count}");
      }
    }
  });

  test("no new value holds a glyph the icon set removes", () => {
    for (const key of new Set(CASES.map(([each]) => each))) {
      for (const table of [EN_US, IT_IT]) {
        const value = table[key];
        const text = typeof value === "string" ? value : `${value.one}${value.other}`;
        expect(text).not.toMatch(/[↓↩↻↗✓✕×]/);
      }
    }
  });

  test("no new key keeps the base's wording of its neighbours: existing values are untouched", () => {
    expect(t("en-US", "bar.submit")).toBe("Submit");
    expect(t("en-US", "question.answer")).toBe("Answer");
    expect(t("en-US", "header.open", { count: 2 })).toBe("2 open");
  });
});
