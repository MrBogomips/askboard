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

/** The pages the web references name: the test answers them itself, so nothing leaves the machine. */
export const RUNBOOK_URL = "https://runbook.example.test/retry?page=1";
export const PULL_URL = "https://github.com/acme/pay/pull/12";

/** One question holding a WEB and a GITHUB reference. */
export const webReferenceAsk: Ask = {
  askId: "context-web-e5f6",
  title: "Web references",
  items: [
    {
      type: "question",
      id: "links",
      props: {
        text: "Is the runbook right?",
        options,
        items: [
          { type: "reference", id: "runbook", props: { url: RUNBOOK_URL, title: "Runbook" } },
          { type: "reference", id: "pull", props: { url: PULL_URL } },
        ],
      },
    },
  ],
};

/** The project of the reading panel's scenarios: a 100-line spec, a binary, a huge file, a link out. */
export const SPEC_PATH = "docs/specs/checkout.md";
export const SPEC_LINES = Array.from({ length: 100 }, (_, at) => `spec line ${at + 1}`);
export const PANEL_POINTER = `${SPEC_PATH}#L40-L52`;

export const panelFiles = (outside: string) =>
  ({
    [SPEC_PATH]: `${SPEC_LINES.join("\n")}\n`,
    "bin/data.bin": Uint8Array.from([0x41, 0x00, 0x42, 0xff, 0x00, 0x43]),
    "big/large.txt": "x\n".repeat(20_001),
    "escape.md": { link: outside },
  }) as const;

/** One question holding the spec as an excerpt and as a FILE reference, and four FILE references. */
export const panelAsk: Ask = {
  askId: "context-panel-g7h8",
  title: "Reading panel",
  items: [
    {
      type: "question",
      id: "spec",
      props: {
        text: "Is the checkout flow right?",
        options,
        items: [
          { type: "excerpt", id: "spec-excerpt", props: { pointer: PANEL_POINTER, title: "Spec" } },
          { type: "reference", id: "ref-file", props: { pointer: PANEL_POINTER } },
          { type: "reference", id: "ref-missing", props: { pointer: "docs/missing.md" } },
          { type: "reference", id: "ref-binary", props: { pointer: "bin/data.bin" } },
          { type: "reference", id: "ref-large", props: { pointer: "big/large.txt" } },
          { type: "reference", id: "ref-outside", props: { pointer: "escape.md" } },
        ],
      },
    },
    {
      type: "question",
      id: "other",
      props: { text: "Anything else?", options },
    },
  ],
};
