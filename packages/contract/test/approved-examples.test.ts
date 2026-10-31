import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { SCHEMA_IDS } from "../src/index.ts";
import { validateAgainst, validateAskRequest } from "../src/validate.ts";

// The approved examples of the review-model-contract change, copied unchanged (task 3.1). Each test
// names the fixture it reads, so a fixture that diverges from the schemas is named when it fails.
const FIXTURES = join(import.meta.dir, "fixtures");
const ARCHIVE = join(
  import.meta.dir,
  "../../../openspec/changes/archive/2026-10-29-review-model-contract/examples",
);

const read = async (path: string): Promise<unknown> => Bun.file(join(FIXTURES, path)).json();
const filesIn = async (folder: string): Promise<string[]> =>
  (await readdir(join(FIXTURES, folder))).filter((name) => name.endsWith(".json")).sort();
const listed = async (root: string): Promise<string[]> =>
  [...new Bun.Glob("**/*").scanSync({ cwd: root })].sort();

const asks = await filesIn("asks");
const answers = await filesIn("answers");

type Answers = { asks: { events: { type: string }[] }[] };
const answerEvents = async (file: string) =>
  ((await read(`answers/${file}`)) as Answers).asks.flatMap((ask) =>
    ask.events.filter((event) => event.type === "answer"),
  );

describe("the approved examples, as fixtures", () => {
  test("the copy matches the archived examples byte for byte", async () => {
    const files = await listed(ARCHIVE);
    expect(await listed(FIXTURES)).toEqual(files);
    for (const file of files) {
      const copy = await Bun.file(join(FIXTURES, file)).text();
      expect({ file, text: copy }).toEqual({
        file,
        text: await Bun.file(join(ARCHIVE, file)).text(),
      });
    }
  });

  test("there are asks and answers to check", () => {
    expect(asks).toContain("plain-choice.json");
    expect(answers).toContain("plain-choice.json");
  });

  test.each(asks)("asks/%s passes the generic ask input schema", async (file) => {
    const ask = await read(`asks/${file}`);
    expect(validateAgainst(SCHEMA_IDS.askRequest, ask)).toEqual({ ok: true, value: ask });
  });

  test("asks/plain-choice.json passes the full contract", async () => {
    const ask = await read("asks/plain-choice.json");
    expect(validateAskRequest(ask)).toEqual({ ok: true, value: ask as never });
  });

  test("results/plain-choice.json passes the ask result envelope", async () => {
    const result = await read("results/plain-choice.json");
    expect(validateAgainst(SCHEMA_IDS.askResult, result)).toEqual({ ok: true, value: result });
  });

  test("answers/plain-choice.json passes the collect result envelope", async () => {
    const result = await read("answers/plain-choice.json");
    expect(validateAgainst(SCHEMA_IDS.collectResult, result)).toEqual({ ok: true, value: result });
  });

  test.each(answers)("every answer event of answers/%s passes the answer event", async (file) => {
    const events = await answerEvents(file);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect({ file, checked: validateAgainst(SCHEMA_IDS.answerEvent, event) }).toEqual({
        file,
        checked: { ok: true, value: event },
      });
    }
  });

  test("an answer event edited out of the schema is refused", async () => {
    const [event] = await answerEvents("plain-choice.json");
    const edited = { ...(event as object), choice: "PostgreSQL" };
    expect(validateAgainst(SCHEMA_IDS.answerEvent, edited)).toMatchObject({
      ok: false,
      problems: [{ path: "/choice" }],
    });
  });
});
