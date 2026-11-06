// The tool request and result envelopes (owner `mcp-tools`, AD-7). The requests are the input
// schemas of the approved tool definitions, generic as AD-6 asks: a tool request names no version.
// Every result names its envelope's version and the output format's (finding F12).

import type { SchemaSet } from "../../versions.ts";
import type { GanttItem } from "../../widgets/gantt/index.ts";
import type { TreeItem } from "../../widgets/tree/index.ts";
import type {
  BoardExcerptProps,
  BoardImageProps,
  BoardQuestion,
  BoardReferenceProps,
} from "../board-document/index.ts";
import type { AskInput, QuestionProps, UpdateInput } from "../input/index.ts";
import {
  type AskState,
  OUTPUT_FORMAT_VERSION,
  type OutputEvent,
  type QuestionState,
  type UnavailableReason,
  type Warning,
} from "../output/index.ts";
import askResult from "./ask-result.json" with { type: "json" };
import askUnavailable from "./ask-unavailable.json" with { type: "json" };
import collectResult from "./collect-result.json" with { type: "json" };
import fetchOutcome from "./fetch-outcome.json" with { type: "json" };
import fetchPage from "./fetch-page.json" with { type: "json" };
import fetchResult from "./fetch-result.json" with { type: "json" };
import snapshotOutcome from "./snapshot-outcome.json" with { type: "json" };
import snapshotResult from "./snapshot-result.json" with { type: "json" };
import definitions from "./tools.json" with { type: "json" };
import updateOutcome from "./update-outcome.json" with { type: "json" };
import updateResult from "./update-result.json" with { type: "json" };
import versions from "./versions.json" with { type: "json" };

export const TOOL_ENVELOPES_VERSION = "1.4";

/** A tool as `tools/list` lists it: the approved definition, unchanged. */
export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly annotations: {
    readonly idempotentHint?: boolean;
    readonly readOnlyHint?: boolean;
    readonly destructiveHint?: boolean;
    readonly openWorldHint?: boolean;
  };
};

/**
 * The contract's copy of the approved `ask`, `update`, `collect`, `fetch` and `snapshot`
 * definitions, in the order `tools/list` lists them (AD-6; ask-lifecycle, open question 1; snapshot
 * design decision 2).
 */
export const TOOL_DEFINITIONS: readonly ToolDefinition[] = definitions.tools;

const DIALECT = "https://json-schema.org/draft/2020-12/schema";

const requestSchema = (name: string): Record<string, unknown> => {
  const tool = TOOL_DEFINITIONS.find((definition) => definition.name === name);
  if (tool === undefined) throw new Error(`the contract defines no tool ${name}`);
  return {
    $schema: DIALECT,
    $id: `urn:askboard:tool-envelopes:${name}-request`,
    title: `${name} request`,
    ...tool.inputSchema,
  };
};

export const toolEnvelopes: SchemaSet = {
  name: "tool-envelopes",
  title: "tool envelopes",
  owner: "mcp-tools",
  version: TOOL_ENVELOPES_VERSION,
  schemas: [
    requestSchema("ask"),
    requestSchema("collect"),
    versions,
    askResult,
    askUnavailable,
    collectResult,
    requestSchema("update"),
    requestSchema("fetch"),
    updateResult,
    updateOutcome,
    fetchResult,
    fetchPage,
    fetchOutcome,
    // E7 (snapshot, design decision 2): the snapshot request, result and typed result.
    requestSchema("snapshot"),
    snapshotResult,
    snapshotOutcome,
  ],
};

export type ResultVersions = { readonly result: string; readonly output: string };

/** The versions every result of this build names. */
export const RESULT_VERSIONS: ResultVersions = {
  result: TOOL_ENVELOPES_VERSION,
  output: OUTPUT_FORMAT_VERSION,
};

/** An `ask` request: E1 accepts what the input format accepts. */
export type AskRequest = AskInput;

export type CollectRequest = {
  readonly asks: readonly { readonly askId: string; readonly after: string }[];
  readonly wait?: { readonly askId: string; readonly itemId: string };
};

export type AskResult = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly askId: string;
  readonly state: AskState;
  readonly cursor: string;
  readonly board: string;
  readonly warnings?: readonly Warning[];
};

export type AskUnavailableResult = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly askId: string;
  readonly outcome: "unavailable";
  readonly reason: UnavailableReason;
  readonly message: string;
};

export type CollectAskEntry = {
  readonly askId: string;
  readonly state: AskState;
  readonly cursor: string;
  readonly events: readonly OutputEvent[];
  readonly unchecked?: true;
};

export type CollectResult = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly asks: readonly CollectAskEntry[];
  readonly more?: true;
  /** Why a waiting collect ended without an event for its item. */
  readonly outcome?: "open" | "postponed" | "closed";
};

// Tool envelopes 1.1 (ask-lifecycle, design decision 2).

/** An `update` request: what the input format accepts. */
export type UpdateRequest = UpdateInput;

/** A `fetch` request: the item, and the continuation of the previous page when there was one. */
export type FetchRequest = {
  readonly askId: string;
  readonly itemId: string;
  readonly continuation?: string;
};

/** What `update` did for one action, in the request's order. */
export type AppliedAction = {
  readonly action: UpdateInput["actions"][number]["action"];
  /** Every action but `close` names its item. */
  readonly itemId?: string;
  /** The question's new revision, where the action changed it. */
  readonly rev?: number;
  /** An answer the agent recorded: who answered and the core's time (FR-19). */
  readonly recorded?: { readonly who: string; readonly when: string };
};

/** What `update` returns once its actions apply: no cursor (AD-3). */
export type UpdateResult = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly askId: string;
  readonly state: AskState;
  readonly applied: readonly AppliedAction[];
  readonly unchecked?: true;
  /** Since 1.2: the unresolved pointers of the questions the update revised (excerpts). */
  readonly warnings?: readonly Warning[];
};

/** `update` on a closed or discarded ask, or one unknown to the epoch: a typed result. */
export type UpdateOutcomeResult = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly askId: string;
  readonly outcome: "closed" | "discarded";
};

/** An answer in full: logged, with its event's cursor, or recorded by the agent, with none. */
export type FetchAnswer = {
  readonly choice?: readonly string[];
  readonly other?: string;
  readonly optionNotes?: Readonly<Record<string, string>>;
  readonly note?: string;
  readonly declined?: true;
  readonly who: string;
  readonly when: string;
} & ({ readonly cursor: string } | { readonly recorded: true });

/** An item as ask-core holds it now (FR-20). */
export type FetchItem =
  | {
      readonly type: "question";
      readonly id: string;
      readonly rev: number;
      readonly props: FetchQuestionProps;
      readonly state: QuestionState;
      readonly answer?: FetchAnswer;
      readonly previous?: FetchAnswer;
    }
  | {
      readonly type: "area";
      readonly id: string;
      readonly props: {
        readonly title: string;
        readonly items: readonly [FetchQuestion, ...FetchQuestion[]];
      };
    };

export type FetchResult = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly askId: string;
  readonly state: AskState;
  readonly item: FetchItem;
  readonly unchecked?: true;
};

/** A slice of an item's RFC 8785 JSON text; the last one has no continuation. */
export type FetchPage = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly askId: string;
  readonly itemId: string;
  readonly part: string;
  readonly continuation?: string;
  readonly unchecked?: true;
};

/** `fetch` on a discarded ask, or one unknown to the epoch: a typed result. */
export type FetchOutcomeResult = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly askId: string;
  readonly outcome: "discarded";
};

// Tool envelopes 1.2 (excerpts, design decision 4): `fetch` gives a question's context items as the
// board document holds them, less an excerpt's text, written or read, and an image's bytes.

/** An excerpt as `fetch` gives it: by pointer, its status and lines; written, its title only. */
export type FetchExcerptProps =
  | Omit<Extract<BoardExcerptProps, { readonly status: "resolved" }>, "text">
  | Extract<BoardExcerptProps, { readonly status: "unresolved" }>
  | { readonly title?: string };

/** An image as `fetch` gives it: its pointer, alt text, status and media type, never its bytes. */
export type FetchImageProps =
  | Omit<Extract<BoardImageProps, { readonly status: "resolved" }>, "bytes">
  | Extract<BoardImageProps, { readonly status: "unresolved" }>;

export type FetchContextItem =
  | { readonly type: "excerpt"; readonly id: string; readonly props: FetchExcerptProps }
  | { readonly type: "reference"; readonly id: string; readonly props: BoardReferenceProps }
  | { readonly type: "image"; readonly id: string; readonly props: FetchImageProps }
  // Since tool envelopes 1.4 (widget-answers): a Tree or a Gantt as the board document holds it.
  | TreeItem
  | GanttItem;

/** A question's props as `fetch` gives them. */
export type FetchQuestionProps = Omit<QuestionProps, "items"> & {
  readonly items?: readonly [FetchContextItem, ...FetchContextItem[]];
};

/** A question of a fetched area. */
export type FetchQuestion = Omit<BoardQuestion, "props"> & { readonly props: FetchQuestionProps };

// Tool envelopes 1.3 (snapshot, design decision 2).

/** A `snapshot` request: the ask, and nothing else. */
export type SnapshotRequest = { readonly askId: string };

/** What `snapshot` returns once the file is written: its absolute path, never its content. */
export type SnapshotResult = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly askId: string;
  readonly state: AskState;
  readonly path: string;
  readonly unchecked?: true;
};

/** `snapshot` on a discarded ask, or one unknown to the epoch: a typed result. */
export type SnapshotOutcomeResult = {
  readonly versions: ResultVersions;
  readonly epoch: string;
  readonly askId: string;
  readonly outcome: "discarded";
};
