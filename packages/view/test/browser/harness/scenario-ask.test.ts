import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { markupBoardDocument } from "../fixtures/markup-document.ts";
import { APPROVED_PLAIN_CHOICE_ASK, askInputFor, questionTexts } from "./scenario-ask.ts";
import { replayTranscripts, withDocument } from "./transcripts.ts";

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

// The approved ask as asks/plain-choice.json holds it: the board document without its version,
// title and rev.
const approved = {
  askId: plainChoiceBoardDocument.askId,
  items: plainChoiceBoardDocument.items.map(({ rev: _, ...item }) => item),
};

const approvedFile = async (content: string) => {
  const dir = await mkdtemp(join(tmpdir(), "askboard-ask-test-"));
  dirs.push(dir);
  const file = join(dir, "plain-choice.json");
  await Bun.write(file, content);
  return file;
};

describe("askInputFor", () => {
  test("is the approved plain-choice ask, read from the contract's fixtures, for its board", async () => {
    expect(APPROVED_PLAIN_CHOICE_ASK).toEndWith(
      "packages/contract/test/fixtures/asks/plain-choice.json",
    );
    const file = await approvedFile(JSON.stringify(approved));
    expect(await askInputFor(replayTranscripts.opening, file)).toEqual(approved);
  });

  test("is the plain-choice ask for a transcript with no board document, such as the restart", async () => {
    const file = await approvedFile(JSON.stringify(approved));
    expect(await askInputFor(replayTranscripts.restart, file)).toEqual(approved);
  });

  test("is the ask that gives another board document, title included", async () => {
    const transcript = withDocument(replayTranscripts.opening, markupBoardDocument);
    const [question] = markupBoardDocument.items;
    const { rev: _, ...item } = question;
    expect(await askInputFor(transcript, "/nonexistent")).toEqual({
      askId: markupBoardDocument.askId,
      title: markupBoardDocument.title,
      items: [item],
    });
  });

  test("fails when the approved ask is missing, saying where it comes from", async () => {
    await expect(askInputFor(replayTranscripts.opening, "/nonexistent/ask.json")).rejects.toThrow(
      "the approved plain-choice ask is not at /nonexistent/ask.json",
    );
  });

  test("fails when the approved ask is not an ask", async () => {
    const file = await approvedFile("[]");
    await expect(askInputFor(replayTranscripts.opening, file)).rejects.toThrow(
      `${file} holds no ask with an askId`,
    );
  });
});

describe("questionTexts", () => {
  test("are the texts of the ask's questions, which stderr must never hold", () => {
    expect(questionTexts(approved)).toEqual([plainChoiceBoardDocument.items[0].props.text]);
    expect(questionTexts({ askId: "a", items: [{ type: "question", id: "q" }] })).toEqual([]);
  });
});
