// The tool request and result envelopes (owner `mcp-tools`, AD-7). The requests are the input
// schemas of the approved tool definitions, generic as AD-6 asks: a tool request names no version.
// Every result names its envelope's version and the output format's (finding F12).

import type { SchemaSet } from "../../versions.ts";
import type { AskInput } from "../input/index.ts";
import {
  type AskState,
  OUTPUT_FORMAT_VERSION,
  type OutputEvent,
  type UnavailableReason,
  type Warning,
} from "../output/index.ts";
import askResult from "./ask-result.json" with { type: "json" };
import askUnavailable from "./ask-unavailable.json" with { type: "json" };
import collectResult from "./collect-result.json" with { type: "json" };
import definitions from "./tools.json" with { type: "json" };
import versions from "./versions.json" with { type: "json" };

export const TOOL_ENVELOPES_VERSION = "1.0";

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
 * The contract's copy of the approved `ask` and `collect` definitions, in the order `tools/list`
 * lists them (AD-6; proposal, open question 4).
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
  readonly outcome?: "open";
};
