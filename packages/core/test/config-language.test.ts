import { describe, expect, test } from "bun:test";
import type { AskInput, ConfigurationValues } from "@askboard/contract";
import { validateBoardDocument } from "@askboard/contract/validate";
import { askWith, coreWith, type FakeConfigOptions, fakeConfig, plainChoiceAsk } from "./fakes.ts";
import { boardOf, FLAT_ID, flatAsk } from "./lifecycle-fakes.ts";

// settings-languages, design decision 7 (core spec: The ask's language is resolved when it is
// created): the ask's own language, else `defaultLanguage` in effect, else en-US; the locale from
// the ask, else its language; both on every revision's board document, whatever an update does.

const v = "1.0";
type Language = ConfigurationValues["defaultLanguage"];

const withConfig = (options: FakeConfigOptions) => {
  const fakes = fakeConfig(options);
  return { ...coreWith({ config: fakes.config }), ...fakes };
};

const languageOf = async (
  ask: Partial<Pick<AskInput, "language" | "locale">>,
  files: { readonly user?: Language; readonly project?: Language } = {},
) => {
  const fileWith = (language: Language | undefined) =>
    language === undefined ? undefined : { version: v, defaultLanguage: language };
  const { core } = withConfig({ user: fileWith(files.user), project: fileWith(files.project) });
  const request = askWith(ask);
  expect((await core.ask(request)).kind).toBe("created");
  const { document } = boardOf(core, request.askId);
  expect(validateBoardDocument(document).ok).toBe(true);
  return { language: document.language, locale: document.locale };
};

const both = (language: Language, locale: Language = language) => ({ language, locale });

describe("the ask's language and locale", () => {
  test("the project's default language wins over the user's when the ask names none", async () => {
    expect(await languageOf({}, { user: "en-US", project: "it-IT" })).toEqual(both("it-IT"));
  });

  test("the user's default language, when the project sets none", async () => {
    expect(await languageOf({}, { user: "it-IT" })).toEqual(both("it-IT"));
  });

  test("en-US when neither file sets one", async () => {
    expect(await languageOf({})).toEqual(both("en-US"));
  });

  test("the agent's language wins, and the locale follows it", async () => {
    expect(await languageOf({ language: "en-US" }, { project: "it-IT" })).toEqual(both("en-US"));
    expect(await languageOf({ language: "it-IT" }, { user: "en-US" })).toEqual(both("it-IT"));
  });

  test("the ask's own locale", async () => {
    expect(await languageOf({ language: "en-US", locale: "it-IT" })).toEqual(
      both("en-US", "it-IT"),
    );
    expect(await languageOf({ locale: "en-US" }, { project: "it-IT" })).toEqual(
      both("it-IT", "en-US"),
    );
  });

  test("without the configuration port, en-US", async () => {
    const { core } = coreWith();
    const request = plainChoiceAsk();
    await core.ask(request);
    expect(core.board(request.askId)?.document).toMatchObject(both("en-US"));
  });
});

describe("kept for the whole ask", () => {
  test("every revision's board document carries both, and an update changes neither", async () => {
    const { core } = withConfig({ project: { version: v, defaultLanguage: "it-IT" } });
    await core.ask({ ...flatAsk(), locale: "en-US" });
    expect(boardOf(core, FLAT_ID).document).toMatchObject(both("it-IT", "en-US"));
    const props = { text: "Ship it?", options: [{ label: "Yes" }, { label: "No" }] };
    const outcome = core.update({
      askId: FLAT_ID,
      actions: [
        { action: "add", item: { type: "question", id: "q9", props } },
        { action: "change", itemId: "q1", props: { text: "Cut from main?" } },
      ],
    });
    expect(outcome.kind).toBe("updated");
    const document = boardOf(core, FLAT_ID).document;
    expect(document.items).toHaveLength(4);
    expect(document).toMatchObject(both("it-IT", "en-US"));
    expect(validateBoardDocument(document).ok).toBe(true);
  });

  test("a change of defaultLanguage while the session runs waits for the next session", async () => {
    const { core, setUser, calls } = withConfig({ user: { version: v, defaultLanguage: "it-IT" } });
    await core.ask(plainChoiceAsk());
    setUser({ version: v, defaultLanguage: "en-US" });
    const later = askWith({ askId: "later-ask-k3m9" });
    await core.ask(later);
    expect(core.board(later.askId)?.document).toMatchObject(both("it-IT"));
    expect(calls.sort()).toEqual(["folders", "project", "user"]);
  });

  test("a refused ask reads no setting", async () => {
    const { core, calls } = withConfig({ user: { version: v, defaultLanguage: "it-IT" } });
    expect((await core.ask({ askId: "x" })).kind).toBe("invalid");
    expect(calls).toEqual([]);
  });
});
