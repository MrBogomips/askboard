// Helpers for the ask lifecycle's tests (ask-lifecycle, groups 2 and 3): the contract's lifecycle
// ask, a three-question ask without areas, act commands with action IDs, and what the subscription
// heard.

import type { Act, LifecycleAskInput, OutputEvent } from "@askboard/contract";
import { lifecycleAsk } from "@askboard/contract/fixtures";
import type { CoreEvent } from "../src/index.ts";
import { coreWith, type FakeOptions } from "./fakes.ts";

/** The contract's lifecycle ask: two areas, five questions, expected user Sara Conti. */
export const LIFECYCLE_ID = lifecycleAsk.askId;

/** A fresh copy of the lifecycle ask. */
export const areasAsk = (): LifecycleAskInput => structuredClone(lifecycleAsk) as LifecycleAskInput;

export const FLAT_ID = "release-plan-r4t8";

/** Three questions without areas: `q1` single choice, `q2` multiple, `q3` with "Other…". */
export const flatAsk = (): LifecycleAskInput => ({
  askId: FLAT_ID,
  items: [
    {
      type: "question",
      id: "q1",
      props: {
        text: "Which branch should the release cut from?",
        options: [{ label: "main" }, { label: "release" }],
      },
    },
    {
      type: "question",
      id: "q2",
      props: {
        text: "Which platforms ship first?",
        multiSelect: true,
        options: [{ label: "macOS" }, { label: "Linux" }, { label: "WSL" }],
      },
    },
    {
      type: "question",
      id: "q3",
      props: {
        text: "Who signs the release off?",
        allowOther: true,
        options: [{ label: "Sara" }, { label: "Marco", recommended: true }],
      },
    },
  ],
});

export const WHEN = "2026-10-31T14:05:12Z";
export const LATER = "2026-10-31T14:06:40Z";

/** A 22-character action ID, distinct per number. */
export const actionId = (n: number): string => `action-${String(n).padStart(15, "0")}`;

let commands = 0;

const nextActionId = (): string => {
  commands += 1;
  return actionId(commands);
};

/** An act command with a fresh action ID, unless one is given. */
export const command = (acts: readonly Act[], id = nextActionId()) => ({ actionId: id, acts });

/** A core with the ask created, and what its subscription hears from then on. */
export const created = async (ask: LifecycleAskInput, options: FakeOptions = {}) => {
  const fixture = coreWith(options);
  const outcome = await fixture.core.ask(ask);
  if (outcome.kind !== "created") throw new Error(`the ask was not created: ${outcome.kind}`);
  fixture.heard.length = 0;
  return fixture;
};

/** The events the subscription told, in order. */
export const appendedOf = (heard: readonly CoreEvent[]): OutputEvent[] =>
  heard.flatMap((event) => (event.type === "appended" ? [...event.events] : []));

/** The ask's whole log, read after `<epoch>.0`. */
export const logOf = (core: ReturnType<typeof coreWith>["core"], askId: string): OutputEvent[] => {
  const read = core.read(askId, `${core.epoch}.0`);
  return read.kind === "events" ? [...read.events] : [];
};

/** The ask's board as `board-host` sees it, failing the test for an ask that has none. */
export const boardOf = (core: ReturnType<typeof coreWith>["core"], askId: string) => {
  const board = core.lifecycleBoard(askId);
  if (board === undefined || board.state === "discarded") throw new Error(`no board for ${askId}`);
  return board;
};

/** Each question's state on the board, by ID, in board order. */
export const statesOf = (core: ReturnType<typeof coreWith>["core"], askId: string) =>
  Object.fromEntries(
    boardOf(core, askId).questions.map((question) => [question.itemId, question.state]),
  );

export const answerAct = (fields: Partial<Extract<Act, { type: "answer" }>> = {}): Act => ({
  type: "answer",
  itemId: "q1",
  rev: 1,
  choice: ["main"],
  when: WHEN,
  ...fields,
});
