// The ask the session-process target sends for a scenario: the approved plain-choice ask, read
// from the contract's copy of the approved examples (task 3.1), for every transcript whose board
// is the plain-choice board document; for a test-only board document, such as the one with markup
// in every agent string, the ask that gives that document.

import { join } from "node:path";
import type { BoardDocument } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type { ReplayTranscript } from "./transcripts.ts";

export type AskInput = { readonly askId: string } & Readonly<Record<string, unknown>>;

const ROOT = join(import.meta.dir, "..", "..", "..", "..", "..");

/** `asks/plain-choice.json` of the approved model contract, as the contract's tests hold it. */
export const APPROVED_PLAIN_CHOICE_ASK = join(
  ROOT,
  "packages",
  "contract",
  "test",
  "fixtures",
  "asks",
  "plain-choice.json",
);

const boardDocumentOf = (transcript: ReplayTranscript): BoardDocument => {
  for (const step of transcript.steps) {
    if (step.from === "host" && "message" in step && step.message.type === "board") {
      return step.message.document;
    }
  }
  return plainChoiceBoardDocument;
};

const readApprovedAsk = async (file: string): Promise<AskInput> => {
  const approved = Bun.file(file);
  if (!(await approved.exists())) {
    throw new Error(
      `the approved plain-choice ask is not at ${file}: it comes with the contract's copy of the approved examples (task 3.1)`,
    );
  }
  const ask: unknown = await approved.json();
  if (typeof ask !== "object" || ask === null || typeof (ask as AskInput).askId !== "string") {
    throw new Error(`${file} holds no ask with an askId`);
  }
  return ask as AskInput;
};

/** The ask whose board the transcript's board document is. */
export const askInputFor = async (
  transcript: ReplayTranscript,
  approvedAsk: string = APPROVED_PLAIN_CHOICE_ASK,
): Promise<AskInput> => {
  const document = boardDocumentOf(transcript);
  if (Bun.deepEquals(document, plainChoiceBoardDocument, true)) {
    return readApprovedAsk(approvedAsk);
  }
  return {
    askId: document.askId,
    title: document.title,
    items: document.items.map(({ rev: _, ...item }) => item),
  };
};

/** The question texts of an ask, which the session process's stderr must never hold (AD-11). */
export const questionTexts = (ask: AskInput): string[] => {
  const items = Array.isArray(ask.items) ? (ask.items as unknown[]) : [];
  return items.flatMap((item) => {
    const props = (item as { props?: { text?: unknown } }).props;
    return typeof props?.text === "string" ? [props.text] : [];
  });
};
