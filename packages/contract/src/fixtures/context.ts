// A board document holding context (excerpts, design decision 2): every status of every context
// item type, as ask-core resolves them. `fix` splits (a resolved excerpt), `rollout` does not (its
// one excerpt is unresolved), and `settings` holds an excerpt the agent wrote. Tests only.

import {
  BOARD_DOCUMENT_VERSION,
  type BoardQuestion,
  type BoardQuestionProps,
  type LifecycleBoardDocument,
} from "../schemas/board-document/index.ts";

/** A question whose props hold context items as the board document carries them. */
export type ContextBoardQuestion = Omit<BoardQuestion, "props"> & {
  readonly props: BoardQuestionProps;
};

export type ContextBoardDocument = Omit<LifecycleBoardDocument, "items"> & {
  readonly items: readonly [ContextBoardQuestion, ...ContextBoardQuestion[]];
};

/** A one-pixel PNG, in base64. */
export const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const options = [{ label: "Fix A" }, { label: "Fix B" }] as const;

/** Board document 1.2 with every context case: three questions, the first of which splits. */
export const contextBoardDocument: ContextBoardDocument = {
  version: BOARD_DOCUMENT_VERSION,
  askId: "payment-retry-fix-q4m8",
  title: "Payment retry fix",
  items: [
    {
      type: "question",
      id: "fix",
      rev: 1,
      props: {
        text: "Which fix should I keep for the failing payment retry?",
        options,
        items: [
          {
            type: "excerpt",
            id: "retry-adr",
            props: {
              pointer: "docs/adr/0012-payment-retries.md#Decision",
              status: "resolved",
              text: "## Decision\n\nWe retry a failed payment three times, with exponential backoff.",
              mediaType: "text/markdown",
              lines: { start: 7, end: 9 },
            },
          },
          {
            type: "reference",
            id: "retry-src",
            props: {
              pointer: "src/retry.ts#L1-L5",
              kind: "file",
              status: "resolved",
              lines: { start: 1, end: 5 },
            },
          },
          {
            type: "reference",
            id: "pr",
            props: { url: "https://github.com/acme/pay/pull/12", title: "PR 12", kind: "github" },
          },
          {
            type: "image",
            id: "shot",
            props: {
              pointer: ".askboard/media/shot.png",
              alt: "The retry log",
              status: "resolved",
              mediaType: "image/png",
              bytes: ONE_PIXEL_PNG,
            },
          },
        ],
      },
    },
    {
      type: "question",
      id: "rollout",
      rev: 1,
      props: {
        text: "Roll the fix out to every region at once?",
        options: [{ label: "Yes" }, { label: "No" }],
        items: [
          {
            type: "excerpt",
            id: "missing-doc",
            props: { pointer: "docs/missing.md#Intro", status: "unresolved", reason: "not-found" },
          },
          {
            type: "reference",
            id: "readme",
            props: { pointer: "README.md", title: "Read me", kind: "file", status: "resolved" },
          },
          {
            type: "reference",
            id: "old-src",
            props: {
              pointer: "vendor/old/retry.ts",
              kind: "file",
              status: "unresolved",
              reason: "outside-root",
            },
          },
          {
            type: "reference",
            id: "runbook",
            props: { url: "https://acme.atlassian.net/wiki/runbook", kind: "web" },
          },
          {
            type: "image",
            id: "diagram",
            props: {
              pointer: ".askboard/media/diagram.svg",
              alt: "The rollout plan",
              status: "unresolved",
              reason: "not-image",
            },
          },
        ],
      },
    },
    {
      type: "question",
      id: "settings",
      rev: 1,
      props: {
        text: "Keep these retry settings?",
        options: [{ label: "Keep" }, { label: "Change" }],
        items: [
          {
            type: "excerpt",
            id: "settings-note",
            props: { text: "retries: 3\nbackoff: exponential", title: "Retry settings" },
          },
        ],
      },
    },
  ],
};
