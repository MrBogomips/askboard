import { describe, expect, test } from "bun:test";
import { EN_US } from "./en-US.ts";
import { t } from "./index.ts";
import { IT_IT } from "./it-IT.ts";
import { STRING_KEYS, type StringKey } from "./keys.ts";

// The strings of "Accept as is" (accept-as-sent, design decision 6; FR-34): the button, its
// description, the status once it is sent and the answered line. The Italian is to review.
const CASES: readonly [StringKey, string, string][] = [
  ["question.acceptAsIs", "Accept as is", "Accetta così com'è"],
  [
    "question.acceptAsIsHint",
    "Answers with the content as the agent sent it.",
    "Risponde con il contenuto così come l'ha inviato l'agente.",
  ],
  [
    "status.acceptedAsIs",
    "Answer sent: accepted as is.",
    "Risposta inviata: accettata così com'è.",
  ],
  ["answer.asSent", "Accepted as is", "Accettata così com'è"],
];

describe("the strings of Accept as is", () => {
  test.each(CASES)("%s in both languages", (key, english, italian) => {
    expect(t("en-US", key, {})).toBe(english);
    expect(t("it-IT", key, {})).toBe(italian);
  });

  test("each key is in the typed keys and in both tables", () => {
    for (const [key] of CASES) {
      expect(STRING_KEYS).toContain(key);
      expect(Object.hasOwn(EN_US, key)).toBe(true);
      expect(Object.hasOwn(IT_IT, key)).toBe(true);
    }
  });
});
