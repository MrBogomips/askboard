// A fake ask-core for board-host's tests: one ask whose board view the test sets, the commands,
// drafts and connection reports it was given, and a subscription the test emits on.

import type { DraftRecord, LifecycleBoardDocument } from "@askboard/contract";
import { PLAIN_CHOICE, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import type {
  ActCommandInput,
  ActOutcome,
  AnswerCommandInput,
  AnswerOutcome,
  CoreEvent,
  LifecycleBoardView,
} from "@askboard/core";
import type { HostCore } from "../../src/board-host/index.ts";

export const REFUSING: AnswerOutcome = {
  ok: false,
  refusal: "answered",
  detail: "the question is already answered",
};

/** What ask-core shows of an ask that is not discarded. */
export type OpenView = Exclude<LifecycleBoardView, { readonly state: "discarded" }>;

/** The plain-choice ask, waiting, as ask-core shows it to board-host. */
export const plainView: OpenView = {
  askId: PLAIN_CHOICE.askId,
  state: "waiting",
  document: plainChoiceBoardDocument as unknown as LifecycleBoardDocument,
  questions: [{ itemId: plainChoiceBoardDocument.items[0].id, rev: 1, state: "open", thread: [] }],
};

export type Call =
  | readonly ["answer", string, AnswerCommandInput]
  | readonly ["act", string, ActCommandInput]
  | readonly ["holdDraft", string, DraftRecord]
  | readonly ["connected" | "disconnected", string];

export type FakeHostCore = {
  readonly core: HostCore;
  readonly calls: Call[];
  /** What the core shows now; the test replaces it. */
  view: LifecycleBoardView;
  draft: DraftRecord | undefined;
  emit(event: CoreEvent): void;
  /** The connection reports, in order. */
  reports(): string[];
};

export const fakeHostCore = (
  options: {
    view?: LifecycleBoardView;
    answer?: AnswerOutcome | ((askId: string, command: AnswerCommandInput) => AnswerOutcome);
    act?: (command: ActCommandInput) => ActOutcome;
    draft?: DraftRecord;
  } = {},
): FakeHostCore => {
  const calls: Call[] = [];
  const listeners = new Set<(event: CoreEvent) => void>();
  const fake: FakeHostCore = {
    calls,
    view: options.view ?? plainView,
    draft: options.draft,
    emit: (event) => {
      for (const listener of listeners) listener(event);
    },
    reports: () =>
      calls.flatMap(([kind]) => (kind === "connected" || kind === "disconnected" ? [kind] : [])),
    core: {
      lifecycleBoard: (askId) => (askId === fake.view.askId ? fake.view : undefined),
      answer: (askId, command) => {
        calls.push(["answer", askId, command]);
        const { answer } = options;
        return typeof answer === "function" ? answer(askId, command) : (answer ?? REFUSING);
      },
      act: (askId, command) => {
        calls.push(["act", askId, command]);
        return options.act?.(command) ?? { ok: true, events: [], repeated: false };
      },
      holdDraft: (askId, record) => {
        calls.push(["holdDraft", askId, record]);
        fake.draft = record;
        return true;
      },
      draftToRestore: () => fake.draft,
      connected: (askId) => {
        calls.push(["connected", askId]);
      },
      disconnected: (askId) => {
        calls.push(["disconnected", askId]);
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  };
  return fake;
};
