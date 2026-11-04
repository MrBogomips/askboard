// Test-only asks for the question card's context layout (excerpts, task 6.3), sent to the session
// process as they are, with the project files their pointers read. A question whose excerpt
// resolves splits; one whose excerpts all fail to resolve, or that holds references only, does
// not; an image follows below both columns.

import { ONE_PIXEL_PNG } from "@askboard/contract/fixtures";

type Ask = { readonly askId: string } & Readonly<Record<string, unknown>>;

/** The project's files: a spec to excerpt, a source to reference, and an image. */
export const PROJECT_FILES = {
  "docs/specs/checkout.md": [
    "# Checkout",
    "",
    "## Order creation",
    "",
    "An order is stored after authorization.",
    "",
  ].join("\n"),
  "src/retry.ts": "export const retries = 3;\n",
  ".askboard/media/shot.png": Uint8Array.from(Buffer.from(ONE_PIXEL_PNG, "base64")),
} as const;

export const SPEC_POINTER = "docs/specs/checkout.md#L3-L5";
export const WRITTEN_TEXT = "retries: 3\nbackoff: exponential";

const options = [{ label: "Yes" }, { label: "No" }];

/** A question with a resolved excerpt, two references and an image. */
const splitting = (id: string) => ({
  type: "question",
  id,
  props: {
    text: `Is ${id} right?`,
    options,
    items: [
      { type: "reference", id: `${id}-src`, props: { pointer: "src/retry.ts#L1" } },
      { type: "excerpt", id: `${id}-spec`, props: { pointer: SPEC_POINTER, title: "Spec" } },
      { type: "reference", id: `${id}-pr`, props: { url: "https://github.com/acme/pay/pull/12" } },
      {
        type: "image",
        id: `${id}-shot`,
        props: { pointer: ".askboard/media/shot.png", alt: "The log" },
      },
    ],
  },
});

/** A question whose only context is an excerpt the agent wrote. */
const written = (id: string) => ({
  type: "question",
  id,
  props: {
    text: "Keep these settings?",
    options,
    items: [
      { type: "excerpt", id: `${id}-note`, props: { text: WRITTEN_TEXT, title: "Settings" } },
    ],
  },
});

/** A question whose only excerpt does not resolve, with a reference. */
const unresolved = (id: string) => ({
  type: "question",
  id,
  props: {
    text: "Roll it out?",
    options,
    items: [
      { type: "excerpt", id: `${id}-gone`, props: { pointer: "docs/missing.md#L1-L3" } },
      { type: "reference", id: `${id}-doc`, props: { pointer: "docs/specs/checkout.md" } },
    ],
  },
});

/** Three questions: split, written and unresolved. */
export const contextAsk: Ask = {
  askId: "context-card-a1b2",
  title: "Context layout",
  items: [splitting("fix"), written("settings"), unresolved("rollout")],
};

/** One question that splits: the single-question board. */
export const singleContextAsk: Ask = {
  askId: "context-single-c3d4",
  title: "One question",
  items: [splitting("only")],
};
