import { describe, expect, test } from "bun:test";
import { EN_US } from "./en-US.ts";
import { t } from "./index.ts";
import { IT_IT } from "./it-IT.ts";
import { STRING_KEYS, type StringKey } from "./keys.ts";

// The texts of the answering flow (answering-flow-fixes, design decision 5; FR-34): the report's
// wording, as written.
const CASES: readonly [StringKey, Record<string, string | number>, string, string][] = [
  [
    "bar.submittedHelp",
    { submit: "Submit" },
    'Answers stay here until you press "Submit".',
    "Le risposte restano qui finché non premi «Submit».",
  ],
  [
    "bar.submittedHelp",
    { submit: "Invia le risposte" },
    'Answers stay here until you press "Invia le risposte".',
    "Le risposte restano qui finché non premi «Invia le risposte».",
  ],
  [
    "status.answerSent",
    { option: "PostgreSQL" },
    "Answer sent: PostgreSQL.",
    "Risposta inviata: PostgreSQL.",
  ],
  ["status.answerSentPlain", {}, "Answer sent.", "Risposta inviata."],
  [
    "status.noteSent",
    {},
    "Note sent; the question is still to do.",
    "Nota inviata; la domanda resta da fare.",
  ],
  [
    "status.ready",
    { count: 1 },
    "Answer ready, not sent. 1 ready.",
    "Risposta pronta, non inviata. 1 pronta.",
  ],
  [
    "status.ready",
    { count: 3 },
    "Answer ready, not sent. 3 ready.",
    "Risposta pronta, non inviata. 3 pronte.",
  ],
  ["status.submitted", { count: 1 }, "1 answer sent.", "1 risposta inviata."],
  ["status.submitted", { count: 4 }, "4 answers sent.", "4 risposte inviate."],
  [
    "status.prefilled",
    { count: 1 },
    "1 question prefilled. Nothing was sent.",
    "1 domanda precompilata. Niente è stato inviato.",
  ],
  [
    "status.prefilled",
    { count: 0 },
    "0 questions prefilled. Nothing was sent.",
    "0 domande precompilate. Niente è stato inviato.",
  ],
  [
    "status.added",
    { count: 1, title: "Store" },
    "The agent added 1 question: Store.",
    "L'agente ha aggiunto 1 domanda: Store.",
  ],
  ["status.added", { count: 2 }, "The agent added 2 questions.", "L'agente ha aggiunto 2 domande."],
];

describe("the strings of the answering flow", () => {
  test.each(CASES)("%s %j in both languages", (key, slots, english, italian) => {
    expect(t("en-US", key, slots)).toBe(english);
    expect(t("it-IT", key, slots)).toBe(italian);
  });

  test("each new key is in the typed keys and in both tables", () => {
    const keys = [...new Set(CASES.map(([key]) => key))];
    expect(keys).toHaveLength(8);
    for (const key of keys) {
      expect(STRING_KEYS).toContain(key);
      expect(Object.hasOwn(EN_US, key)).toBe(true);
      expect(Object.hasOwn(IT_IT, key)).toBe(true);
    }
  });

  test("no new value holds a glyph the icon set removes", () => {
    for (const key of STRING_KEYS.filter(
      (each) => each.startsWith("status.") || each === "bar.submittedHelp",
    )) {
      for (const table of [EN_US, IT_IT]) {
        const value = table[key];
        const text = typeof value === "string" ? value : `${value.one}${value.other}`;
        expect(text).not.toMatch(/[↓↩↻↗✓✕×]/);
      }
    }
  });

  test("no status message claims delivery", () => {
    for (const key of STRING_KEYS.filter((each) => each.startsWith("status."))) {
      for (const table of [EN_US, IT_IT]) {
        const value = table[key];
        const text = typeof value === "string" ? value : `${value.one}${value.other}`;
        expect(text).not.toMatch(/deliver|consegnat/i);
      }
    }
  });
});
