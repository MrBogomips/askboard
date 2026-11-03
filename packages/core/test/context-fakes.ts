// Fakes for E5's context tests (excerpts, groups 3 and 4): a `SourceFiles` port that records every
// call, answers each pointer as the test says (by default, resolved), can hold a call until the
// test lets it go or forever, and counts how many run at once; a core built with it; and the asks
// that hold context items.

import type { ContextItem, LifecycleAskInput } from "@askboard/contract";
import { ONE_PIXEL_PNG } from "@askboard/contract/fixtures";
import {
  AskCore,
  type CoreEvent,
  type EditorTarget,
  type ExcerptResolution,
  type ImageResolution,
  type ReferenceResolution,
  type SourceFiles,
  type SourceState,
  type SourceText,
} from "../src/index.ts";
import { type FakeOptions, fakePorts } from "./fakes.ts";
import { fakeRecordTable } from "./push-fakes.ts";

export const PROJECT_ROOT = "/home/paola/orders";

export type SourceCall = {
  readonly op: keyof SourceFiles;
  readonly root: string;
  readonly pointer: string;
  readonly sentText?: string;
};

type Answers = {
  readonly resolveExcerpt: ExcerptResolution;
  readonly resolveImage: ImageResolution;
  readonly resolveReference: ReferenceResolution;
  readonly sourceState: SourceState;
  readonly readSource: SourceText;
  readonly editorTarget: EditorTarget | undefined;
};

export type FakeSourceOptions = {
  /** The answer to any call on these pointers, in place of the default. */
  readonly answers?: Readonly<Record<string, Partial<Answers>>>;
  /** Pointers whose calls never settle. */
  readonly hang?: readonly string[];
  /** Pointers whose calls reject. */
  readonly reject?: readonly string[];
  /** Hold every call until `release` lets it go. */
  readonly held?: boolean;
};

const defaults = (root: string, pointer: string): Answers => ({
  resolveExcerpt: {
    status: "resolved",
    text: `text of ${pointer}`,
    mediaType: "text/markdown",
    lines: { start: 7, end: 9 },
  },
  resolveImage: { status: "resolved", mediaType: "image/png", bytes: ONE_PIXEL_PNG },
  resolveReference: { status: "resolved" },
  sourceState: { status: "available", line: 7 },
  readSource: { status: "available", text: `source of ${pointer}` },
  editorTarget: { file: `${root}/${pointer.split("#")[0]}`, line: 7 },
});

export const fakeSources = (options: FakeSourceOptions = {}) => {
  const calls: SourceCall[] = [];
  const waiting: (() => void)[] = [];
  let running = 0;
  let most = 0;
  const call = <K extends keyof Answers>(
    op: K,
    root: string,
    pointer: string,
    sentText?: string,
  ): Promise<Answers[K]> => {
    calls.push({ op, root, pointer, ...(sentText === undefined ? {} : { sentText }) });
    running += 1;
    most = Math.max(most, running);
    if (options.hang?.includes(pointer)) return new Promise(() => {});
    const answer = () => {
      running -= 1;
      if (options.reject?.includes(pointer)) throw new Error(`EIO reading ${pointer}`);
      const given = options.answers?.[pointer];
      return given !== undefined && op in given
        ? (given[op] as Answers[K])
        : defaults(root, pointer)[op];
    };
    if (!options.held) return Promise.resolve().then(answer);
    return new Promise<void>((resolve) => waiting.push(resolve)).then(answer) as Promise<
      Answers[K]
    >;
  };
  const port: SourceFiles = {
    resolveExcerpt: (root, pointer) => call("resolveExcerpt", root, pointer),
    resolveImage: (root, pointer) => call("resolveImage", root, pointer),
    resolveReference: (root, pointer) => call("resolveReference", root, pointer),
    sourceState: (root, pointer, sentText) => call("sourceState", root, pointer, sentText),
    readSource: (root, pointer) => call("readSource", root, pointer),
    editorTarget: (root, pointer) => call("editorTarget", root, pointer),
  };
  return {
    port,
    calls,
    /** Lets every held call go. */
    release: () => {
      for (const go of waiting.splice(0)) go();
    },
    get running() {
      return running;
    },
    get most() {
      return most;
    },
  };
};

export type ContextCoreOptions = FakeOptions &
  FakeSourceOptions & {
    /** The session project root; `null` leaves it out. */
    readonly projectRoot?: string | null;
    /** Build the core without the `SourceFiles` port. */
    readonly noSources?: boolean;
  };

/** ask-core with E1's fake ports, a fake record table and the fake `SourceFiles` port. */
export const contextCoreWith = (options: ContextCoreOptions = {}) => {
  const fakes = fakePorts(options);
  const sources = fakeSources(options);
  const table = fakeRecordTable();
  const projectRoot = options.projectRoot === undefined ? PROJECT_ROOT : options.projectRoot;
  const core = new AskCore({
    ...fakes.ports,
    records: table.port,
    ...(options.noSources ? {} : { sources: sources.port }),
    ...(projectRoot === null ? {} : { projectRoot }),
  });
  const heard: CoreEvent[] = [];
  core.subscribe((event) => heard.push(event));
  return { core, heard, sources, table, ...fakes };
};

export const CONTEXT_ASK_ID = "payment-retry-fix-q4m8";

/** The UJ-1 excerpt pointer of the approved ask. */
export const ADR_POINTER = "docs/adr/0012-payment-retries.md#Decision";

/** One of each context item: pointer and written excerpts, a file and two web references, an image. */
export const everyItem = (): [ContextItem, ...ContextItem[]] => [
  { type: "excerpt", id: "retry-adr", props: { pointer: ADR_POINTER } },
  { type: "excerpt", id: "note", props: { text: "<script>alert(1)</script>", title: "Note" } },
  { type: "reference", id: "retry-src", props: { pointer: "src/retry.ts#L1-L5" } },
  { type: "reference", id: "pr", props: { url: "https://github.com/acme/orders/pull/12" } },
  { type: "reference", id: "docs", props: { url: "https://example.com/retries" } },
  { type: "image", id: "shot", props: { pointer: ".askboard/media/shot.png", alt: "The failure" } },
];

/** An ask of one question holding `items`, or two when `second` is given. */
export const contextAsk = (
  items: readonly ContextItem[] = everyItem(),
  second?: readonly ContextItem[],
): LifecycleAskInput => ({
  askId: CONTEXT_ASK_ID,
  items: [
    {
      type: "question",
      id: "fix",
      props: {
        text: "Which fix should I keep for the failing payment retry?",
        options: [{ label: "Fix A" }, { label: "Fix B" }],
        ...(items.length === 0 ? {} : { items: items as [ContextItem, ...ContextItem[]] }),
      },
    },
    ...(second === undefined
      ? []
      : [
          {
            type: "question" as const,
            id: "rollout",
            props: {
              text: "Roll out behind a flag?",
              options: [{ label: "Yes" }, { label: "No" }],
              ...(second.length === 0 ? {} : { items: second as [ContextItem, ...ContextItem[]] }),
            },
          },
        ]),
  ],
});

/** An excerpt pointing at `pointer`. */
export const excerpt = (id: string, pointer: string): ContextItem => ({
  type: "excerpt",
  id,
  props: { pointer },
});

/** The context items of a question of the ask's current board document. */
export const boardItemsOf = (core: AskCore, askId: string, questionId = "fix") => {
  const view = core.lifecycleBoard(askId);
  if (view === undefined || !("document" in view)) throw new Error(`no board for ${askId}`);
  const questions = view.document.items.flatMap((item) =>
    item.type === "area" ? item.props.items : [item],
  );
  return questions.find((question) => question.id === questionId)?.props.items;
};

/** Lets pending promise callbacks run, `rounds` macrotask turns. */
export const turns = async (rounds = 3): Promise<void> => {
  for (let round = 0; round < rounds; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
