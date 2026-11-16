import { describe, expect, test } from "bun:test";
import { EN_US } from "./en-US.ts";
import { t } from "./index.ts";
import { IT_IT } from "./it-IT.ts";
import { STRING_KEYS, type StringKey } from "./keys.ts";

// The new strings of the visual pass (answering-flow-visual, design decision 17; FR-34): the
// mockup's wording as drawn, the Italian marked "(to review)" in EXPERIENCE.md's Voice and Tone.
type Case = [StringKey, Record<string, string | number>, string, string];

const CASES: readonly Case[] = [
  ["header.askPill", { state: "Waiting" }, "Ask: Waiting", "Richiesta: Waiting"],
  ["progress.label", {}, "Progress", "Avanzamento"],
  [
    "progress.segment",
    { number: "Q2", chip: "Cache", state: "Draft" },
    "Q2 Cache: Draft",
    "Q2 Cache: Draft",
  ],
  ["question.number", { n: 4 }, "Q4", "D4"],
  ["outline.removed", { number: "Q3" }, "Q3 removed by the agent", "Q3 rimossa dall'agente"],
  [
    "outbox.held",
    { count: 1 },
    "1 answer ready: nothing has been sent yet.",
    "1 risposta pronta: niente è stato ancora inviato.",
  ],
  [
    "outbox.held",
    { count: 3 },
    "3 answers ready: nothing has been sent yet.",
    "3 risposte pronte: niente è stato ancora inviato.",
  ],
  ["ledger.drafts", {}, "Drafts", "Bozze"],
  ["ledger.ready", {}, "Ready", "Pronte"],
  ["ledger.sent", {}, "Sent", "Inviate"],
  ["ledger.delivered", {}, "Delivered", "Consegnate"],
  ["ledger.readyOff", {}, 'Not used in "One by one"', "Non usato in «Una alla volta»"],
  ["answer.line", { answer: "Redis" }, "Answer: Redis", "Risposta: Redis"],
  ["question.chooseOption", {}, "Choose an option", "Scegli un'opzione"],
  ["tray.go", {}, "Go", "Vai"],
  ["tray.close", {}, "Close", "Chiudi"],
  [
    "status.removed",
    { title: "Cache" },
    "Question removed by the agent: Cache.",
    "Domanda rimossa dall'agente: Cache.",
  ],
  [
    "bar.postponedWarning",
    { count: 1 },
    "You have 1 postponed question: closing loses this ask",
    "Hai 1 domanda rimandata: chiudendo perdi questa richiesta",
  ],
  [
    "bar.postponedWarning",
    { count: 2 },
    "You have 2 postponed questions: closing loses this ask",
    "Hai 2 domande rimandate: chiudendo perdi questa richiesta",
  ],
];

describe("the strings of the visual pass", () => {
  test.each(CASES)("%s %j in both languages", (key, slots, english, italian) => {
    expect(t("en-US", key, slots)).toBe(english);
    expect(t("it-IT", key, slots)).toBe(italian);
  });

  test("each key is in the typed keys and in both tables", () => {
    for (const key of new Set(CASES.map(([each]) => each))) {
      expect(STRING_KEYS).toContain(key);
      expect(Object.hasOwn(EN_US, key)).toBe(true);
      expect(Object.hasOwn(IT_IT, key)).toBe(true);
    }
  });

  test("outbox.held has both count forms", () => {
    for (const table of [EN_US, IT_IT]) {
      const value = table["outbox.held"];
      expect(typeof value).toBe("object");
      if (typeof value === "string") continue;
      expect(value.one).toContain("{count}");
      expect(value.other).toContain("{count}");
    }
  });
});
