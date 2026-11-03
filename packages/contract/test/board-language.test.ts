import { describe, expect, test } from "bun:test";
import { lifecycleBoardDocument, plainChoiceBoardDocument } from "../src/fixtures/index.ts";
import { languageOf } from "../src/index.ts";
import { validateBoardDocument } from "../src/validate.ts";

// settings-languages, design decision 7 (contract spec: The board document names the ask's
// language and locale): board document 1.2 carries both at its root, each en-US or it-IT.
const paths = (result: ReturnType<typeof validateBoardDocument>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);

describe("the board document's language and locale", () => {
  test.each([
    ["E1's plain question", plainChoiceBoardDocument],
    ["E3's areas", lifecycleBoardDocument],
  ])("%s with both set to it-IT validates", (_, document) => {
    const italian = { ...document, language: "it-IT", locale: "it-IT" };
    expect(validateBoardDocument(italian)).toEqual({ ok: true, value: italian as never });
  });

  test("English with Italian formats validates", () => {
    const mixed = { ...lifecycleBoardDocument, language: "en-US", locale: "it-IT" };
    expect(validateBoardDocument(mixed).ok).toBe(true);
  });

  test.each(["language", "locale"])("%s fr-FR fails, naming the field", (field) => {
    expect(paths(validateBoardDocument({ ...lifecycleBoardDocument, [field]: "fr-FR" }))).toEqual([
      `/${field}`,
    ]);
  });

  test("a document without either field still validates, at the new minor and an older one", () => {
    const older = { ...lifecycleBoardDocument, version: "1.1" };
    expect(validateBoardDocument(older).ok).toBe(true);
    expect(validateBoardDocument(lifecycleBoardDocument).ok).toBe(true);
  });
});

describe("languageOf, the reader's helper", () => {
  test("a document without either field reads as en-US for both, as an older Snapshot does", () => {
    expect(languageOf(lifecycleBoardDocument)).toEqual({ language: "en-US", locale: "en-US" });
  });

  test("a document's own fields are kept", () => {
    expect(languageOf({ language: "it-IT", locale: "it-IT" })).toEqual({
      language: "it-IT",
      locale: "it-IT",
    });
    expect(languageOf({ language: "en-US", locale: "it-IT" })).toEqual({
      language: "en-US",
      locale: "it-IT",
    });
  });

  test("a language without a locale formats in that language, as ask-core resolves it", () => {
    expect(languageOf({ language: "it-IT" })).toEqual({ language: "it-IT", locale: "it-IT" });
  });
});
