// The tool request and result envelopes (owner `mcp-tools`, AD-7). The requests are the input
// schemas of the approved tool definitions, generic as AD-6 asks: a tool request names no version.
// Every result names its envelope's version and the output format's (finding F12).

import type { SchemaSet } from "../../versions.ts";
import type { BoardQuestion } from "../board-document/index.ts";
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
import definitions from "./tools.json" with { type: "json" };
import updateOutcome from "./update-outcome.json" with { type: "json" };
import updateResult from "./update-result.json" with { type: "json" };
import versions from "./versions.json" with { type: "json" };

export const TOOL_ENVELOPES_VERSION = "1.1";

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
 * The contract's copy of the approved `ask`, `update`, `collect` and `fetch` definitions, in the
 * order `tools/list` lists them (AD-6; ask-lifecycle, open question 1).
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
      readonly props: QuestionProps;
      readonly state: QuestionState;
      readonly answer?: FetchAnswer;
      readonly previous?: FetchAnswer;
    }
  | {
      readonly type: "area";
      readonly id: string;
      readonly props: {
        readonly title: string;
        readonly items: readonly [BoardQuestion, ...BoardQuestion[]];
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
