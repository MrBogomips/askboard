import { describe, expect, test } from "bun:test";
import { bannerOf } from "../board-page/board-status.ts";
import { tabTitle } from "../board-page/tab-title.ts";
import { EN_US } from "./en-US.ts";
import { fill, htmlLang, languageOf, localeOf, STRINGS, t } from "./index.ts";
import { IT_IT } from "./it-IT.ts";
import { STRING_KEYS, type StringTable, type Template } from "./keys.ts";

// The string catalogue (settings-languages design decision 9; view-and-widgets spec, "Every string
// in both languages"): one table per language, the same keys and slots in each, no empty value;
// slots filled as text only, and `one` and `other` for counts.

const SLOT = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

const forms = (template: Template): readonly string[] =>
  typeof template === "string" ? [template] : [template.one, template.other];

const slotsOf = (template: Template): string[] =>
  [...new Set(forms(template).flatMap((form) => [...form.matchAll(SLOT)].map((m) => m[1])))]
    .filter((name): name is string => name !== undefined)
    .sort();

/** Every way two tables disagree, each naming the key. */
const catalogueProblems = (tables: Readonly<Record<string, Record<string, Template>>>) => {
  const problems: string[] = [];
  const keys = new Set(Object.values(tables).flatMap((table) => Object.keys(table)));
  for (const key of [...keys].sort()) {
    const present = Object.entries(tables).filter(([, table]) => Object.hasOwn(table, key));
    for (const [language] of Object.entries(tables)) {
      if (!present.some(([name]) => name === language))
        problems.push(`${key}: missing in ${language}`);
    }
    const slots = new Set(present.map(([, table]) => slotsOf(table[key] as Template).join(",")));
    if (slots.size > 1) problems.push(`${key}: the languages hold different slots`);
    for (const [language, table] of present) {
      const form = table[key] as Template;
      const empty = forms(form).some((text) => text.trim() === "");
      if (empty) problems.push(`${key}: empty in ${language}`);
      if (typeof form !== "string" && !slotsOf(form.other).includes("count")) {
        problems.push(`${key}: the other form in ${language} has no {count}`);
      }
    }
  }
  return problems;
};

describe("the catalogue", () => {
  test("holds the same keys, the same slots per key and no empty value in both languages", () => {
    expect(catalogueProblems({ "en-US": EN_US, "it-IT": IT_IT })).toEqual([]);
  });

  test("each table holds exactly the typed keys", () => {
    expect(Object.keys(EN_US).sort()).toEqual([...STRING_KEYS].sort());
    expect(Object.keys(IT_IT).sort()).toEqual([...STRING_KEYS].sort());
    expect(Object.keys(STRINGS)).toEqual(["en-US", "it-IT"]);
  });

  test("a string in one language only fails the check, naming its key", () => {
    const english: StringTable = { ...EN_US, "item.loading": "Loading" };
    const { "item.loading": _, ...italian } = IT_IT;
    expect(catalogueProblems({ "en-US": english, "it-IT": italian })).toEqual([
      "item.loading: missing in it-IT",
    ]);
  });

  test("different slots or an empty value fail the check, naming the key", () => {
    expect(
      catalogueProblems({
        "en-US": { "tab.title": "{title} · AskBoard", "item.loading": "Loading" },
        "it-IT": { "tab.title": "{titolo} · AskBoard", "item.loading": " " },
      }),
    ).toEqual(["item.loading: empty in it-IT", "tab.title: the languages hold different slots"]);
    expect(catalogueProblems({ "en-US": { n: { one: "{count} more", other: "more" } } })).toEqual([
      "n: the other form in en-US has no {count}",
    ]);
  });
});

describe("the English table is the view's text on main, word for word", () => {
  test("the board page's banners and tab", () => {
    expect(bannerOf({ kind: "retrying" })?.text).toBe(t("en-US", "banner.connectionLost"));
    expect(bannerOf({ kind: "moved" })?.text).toBe(t("en-US", "banner.moved"));
    expect<string | undefined>(bannerOf({ kind: "moved" })?.action).toBe(
      t("en-US", "banner.continueHere"),
    );
    expect(bannerOf({ kind: "discarded" })?.text).toBe(t("en-US", "banner.discarded"));
    expect(bannerOf({ kind: "discarded" }, true)?.detail).toBe(t("en-US", "banner.unsentNotSent"));
    expect(t("en-US", "tab.title", { title: "Order DB" })).toBe(tabTitle("Order DB"));
  });

  test("every other string", () => {
    expect(EN_US).toMatchObject({
      "board.loadError": "The board could not be loaded: {reason}",
      "header.ask": "Ask",
      "state.waiting": "Waiting",
      "state.answered": "Answered",
      "state.discarded": "Discarded",
      "question.answer": "Answer",
      "question.options": "Options",
      "question.optionsPickOne": "Options · pick one",
      "receipt.notSentYet": "not sent yet",
      "receipt.sent": "sent",
      "receipt.delivered": "delivered to the agent",
      "item.error": "This item could not be shown.",
      "item.loading": "Loading",
    });
  });
});

describe("the Italian table", () => {
  test("holds the UX draft's strings", () => {
    expect(IT_IT).toMatchObject({
      "tab.title": "{title} · AskBoard",
      "banner.connectionLost": "Connessione persa, nuovo tentativo in corso",
      "banner.moved": "Questa board si è spostata in un'altra scheda.",
      "banner.continueHere": "Continua qui",
      "banner.discarded": "Questa richiesta è stata scartata. La board è in sola lettura.",
      "banner.unsentNotSent": "Il lavoro non inviato non è stato inviato",
      "header.ask": "Richiesta",
      "state.waiting": "In attesa",
      "state.answered": "Con risposta",
      "state.discarded": "Scartata",
      "question.answer": "Rispondi",
      "question.options": "Opzioni",
      "question.optionsPickOne": "Opzioni · scegline una",
      "receipt.notSentYet": "non ancora inviata",
      "receipt.sent": "inviata",
      "receipt.delivered": "consegnata all'agente",
    });
  });
});

describe("a lookup", () => {
  test("gives the text in the asked language", () => {
    expect(t("en-US", "question.answer")).toBe("Answer");
    expect(t("it-IT", "question.answer")).toBe("Rispondi");
  });

  test("fills slots as text: markup and braces in a slot stay as they are", () => {
    expect(t("en-US", "tab.title", { title: "<b>Bold</b>" })).toBe("<b>Bold</b> · AskBoard");
    expect(t("it-IT", "board.loadError", { reason: "{reason} & <i>" })).toBe(
      "Impossibile caricare la board: {reason} & <i>",
    );
  });

  test("fills a slot that appears twice, and writes a number slot as its digits", () => {
    expect(fill("{a} and {a} of {n}", { a: "x", n: 3 })).toBe("x and x of 3");
  });

  test("refuses a missing slot, naming it", () => {
    expect(() => t("en-US", "tab.title")).toThrow('the slot "title" has no value');
  });

  test("picks one or other by count", () => {
    const counted = { one: "{count} open", other: "{count} open ones" };
    expect(fill(counted, { count: 1 })).toBe("1 open");
    expect(fill(counted, { count: 0 })).toBe("0 open ones");
    expect(fill(counted, { count: 2 })).toBe("2 open ones");
    expect(fill(counted, { count: 1.5 })).toBe("1.5 open ones");
  });

  test("refuses a count form without a number count", () => {
    expect(() => fill({ one: "{count} x", other: "{count} xs" }, {})).toThrow("count");
    expect(() => fill({ one: "{count} x", other: "{count} xs" }, { count: "2" })).toThrow("count");
  });

  test("refuses a language outside the two", () => {
    expect(() => t("fr-FR" as never, "question.answer")).toThrow(RangeError);
  });
});

describe("the board's language (task 7.2)", () => {
  test("is the board document's, en-US when it holds none or there is no board", () => {
    expect(languageOf({ language: "it-IT" })).toBe("it-IT");
    expect(languageOf({})).toBe("en-US");
    expect(languageOf(undefined)).toBe("en-US");
  });

  test("its locale is the document's, else its language (task 7.3)", () => {
    expect(localeOf({ language: "en-US", locale: "it-IT" })).toBe("it-IT");
    expect(localeOf({ language: "it-IT" })).toBe("it-IT");
    expect(localeOf({})).toBe("en-US");
    expect(localeOf(undefined)).toBe("en-US");
  });

  test("is written as the document's lang: en or it", () => {
    expect(htmlLang("en-US")).toBe("en");
    expect(htmlLang("it-IT")).toBe("it");
  });
});
