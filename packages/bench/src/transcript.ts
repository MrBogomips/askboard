// Reading Claude Code's transcripts and `stream-json` output (early-benchmark design decision 8).
// The transcript format is undocumented: these are the fields the mod delivery spike and the
// research observed. A field missing from every entry stays undefined, never zero.

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type ToolCall = {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
  /** t1: the timestamp of the entry holding the `tool_use` block. */
  readonly at: number;
};

/** One model response, its entries grouped by `requestId` and its usage counted once. */
export type Request = {
  readonly key: string;
  readonly index: number;
  /** t0: the timestamp of the entry that triggered the request. */
  readonly start: number | undefined;
  readonly output: number;
  readonly thinking: number | undefined;
  readonly totalInput: number;
  readonly calls: readonly ToolCall[];
  readonly hasText: boolean;
};

export type ToolResult = { readonly at: number; readonly isError: boolean; readonly text: string };

export type Observed = {
  readonly versions: readonly string[];
  readonly models: readonly string[];
  readonly efforts: readonly string[];
  readonly cacheWrites: { readonly "5m": number; readonly "1h": number };
};

export type Transcript = {
  readonly requests: readonly Request[];
  readonly results: ReadonlyMap<string, ToolResult>;
  readonly observed: Observed;
};

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const timeOf = (row: Row | undefined): number | undefined => {
  const time = typeof row?.timestamp === "string" ? Date.parse(row.timestamp) : Number.NaN;
  return Number.isNaN(time) ? undefined : time;
};

const rowsOf = (text: string): Row[] =>
  text.split("\n").flatMap((line) => {
    if (line.trim() === "") return [];
    try {
      const row: unknown = JSON.parse(line);
      return isRecord(row) ? [row] : [];
    } catch {
      return [];
    }
  });

const messageOf = (row: Row): Row => (isRecord(row.message) ? row.message : {});
const blocksOf = (row: Row): Row[] => {
  const content = messageOf(row).content;
  return Array.isArray(content) ? content.filter(isRecord) : [];
};

const resultText = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(isRecord)
    .map((block) => (typeof block.text === "string" ? block.text : ""))
    .join("");
};

type Group = { key: string; rows: Row[]; first: Row; firstIndex: number };

const groupRequests = (rows: readonly Row[]): Group[] => {
  const groups = new Map<string, Group>();
  rows.forEach((row, index) => {
    if (row.type !== "assistant") return;
    const message = messageOf(row);
    const key = [row.requestId, message.id, row.uuid].find((id) => typeof id === "string");
    if (typeof key !== "string") return;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, { key, rows: [row], first: row, firstIndex: index });
    else group.rows.push(row);
  });
  return [...groups.values()];
};

// The entry with the most output carries the response's final usage.
const usageOf = (group: Group): Row => {
  const usages = group.rows.map((row) => messageOf(row).usage).filter(isRecord);
  return usages.reduce<Row>(
    (best, usage) =>
      numberOr(usage.output_tokens, 0) >= numberOr(best.output_tokens, -1) ? usage : best,
    {},
  );
};

const thinkingOf = (usage: Row): number | undefined => {
  const details = usage.output_tokens_details;
  return isRecord(details) && typeof details.thinking_tokens === "number"
    ? details.thinking_tokens
    : undefined;
};

const requestOf = (
  group: Group,
  index: number,
  rows: readonly Row[],
  byUuid: Map<string, Row>,
): Request => {
  const usage = usageOf(group);
  const parent =
    typeof group.first.parentUuid === "string" ? byUuid.get(group.first.parentUuid) : undefined;
  const trigger = parent ?? rows[group.firstIndex - 1];
  const calls: ToolCall[] = [];
  let hasText = false;
  for (const row of group.rows) {
    for (const block of blocksOf(row)) {
      if (block.type === "text") hasText = true;
      if (block.type === "tool_use" && typeof block.id === "string") {
        const at = timeOf(row) ?? 0;
        calls.push({ id: block.id, name: String(block.name), input: block.input, at });
      }
    }
  }
  return {
    key: group.key,
    index,
    start: timeOf(trigger),
    output: numberOr(usage.output_tokens, 0),
    thinking: thinkingOf(usage),
    totalInput:
      numberOr(usage.input_tokens, 0) +
      numberOr(usage.cache_creation_input_tokens, 0) +
      numberOr(usage.cache_read_input_tokens, 0),
    calls,
    hasText,
  };
};

const resultsOf = (rows: readonly Row[]): Map<string, ToolResult> => {
  const results = new Map<string, ToolResult>();
  for (const row of rows) {
    if (row.type !== "user") continue;
    for (const block of blocksOf(row)) {
      if (block.type !== "tool_result" || typeof block.tool_use_id !== "string") continue;
      const isError = block.is_error === true;
      results.set(block.tool_use_id, {
        at: timeOf(row) ?? 0,
        isError,
        text: resultText(block.content),
      });
    }
  }
  return results;
};

const distinct = (values: readonly unknown[]): string[] =>
  [...new Set(values.filter((value): value is string => typeof value === "string"))].sort();

const observedOf = (rows: readonly Row[], groups: readonly Group[]): Observed => {
  const assistants = rows.filter((row) => row.type === "assistant");
  const writes = groups.reduce(
    (sum, group) => {
      const creation = usageOf(group).cache_creation;
      if (!isRecord(creation)) return sum;
      return {
        "5m": sum["5m"] + numberOr(creation.ephemeral_5m_input_tokens, 0),
        "1h": sum["1h"] + numberOr(creation.ephemeral_1h_input_tokens, 0),
      };
    },
    { "5m": 0, "1h": 0 },
  );
  return {
    versions: distinct(rows.map((row) => row.version)),
    models: distinct(assistants.map((row) => messageOf(row).model)),
    efforts: distinct(assistants.map((row) => row.effort)),
    cacheWrites: writes,
  };
};

export const parseTranscript = (text: string): Transcript => {
  const rows = rowsOf(text);
  const byUuid = new Map<string, Row>();
  for (const row of rows) if (typeof row.uuid === "string") byUuid.set(row.uuid, row);
  const groups = groupRequests(rows);
  return {
    requests: groups.map((group, index) => requestOf(group, index, rows, byUuid)),
    results: resultsOf(rows),
    observed: observedOf(rows, groups),
  };
};

/** Where Claude Code keeps transcripts: `$CLAUDE_CONFIG_DIR/projects`, else `~/.claude/projects`. */
export const projectsRoot = (
  env: Readonly<Record<string, string | undefined>>,
  home: string,
): string => join(env.CLAUDE_CONFIG_DIR ?? join(home, ".claude"), "projects");

export type TranscriptFiles = { readonly main: string | undefined; readonly subagents: string[] };

/** The session's transcript under any project folder, and its subagents' transcripts. */
export const findTranscripts = (root: string, sessionId: string): TranscriptFiles => {
  if (!existsSync(root)) return { main: undefined, subagents: [] };
  for (const folder of readdirSync(root)) {
    const main = join(root, folder, `${sessionId}.jsonl`);
    if (!existsSync(main)) continue;
    const dir = join(root, folder, sessionId, "subagents");
    const subagents = existsSync(dir)
      ? readdirSync(dir)
          .filter((name) => name.endsWith(".jsonl"))
          .sort()
          .map((name) => join(dir, name))
      : [];
    return { main, subagents };
  }
  return { main: undefined, subagents: [] };
};

export type Init = {
  readonly model: string | undefined;
  readonly version: string | undefined;
  readonly tools: readonly string[];
  readonly mcpServers: readonly { readonly name: string; readonly status: string }[];
  readonly plugins: readonly { readonly name: string; readonly path: string }[];
  readonly skills: readonly string[];
  readonly result: { readonly subtype: string; readonly isError: boolean } | undefined;
};

const listOf = <T>(value: unknown, pick: (item: Row) => T): T[] =>
  Array.isArray(value) ? value.filter(isRecord).map(pick) : [];

/** The `system/init` message of `stream-json` output, and the final result's kind. */
export const parseInit = (stream: string): Init | undefined => {
  const rows = rowsOf(stream);
  const init = rows.find((row) => row.type === "system" && row.subtype === "init");
  if (init === undefined) return undefined;
  const result = rows.find((row) => row.type === "result");
  return {
    model: typeof init.model === "string" ? init.model : undefined,
    version: typeof init.claude_code_version === "string" ? init.claude_code_version : undefined,
    tools: Array.isArray(init.tools) ? init.tools.map(String) : [],
    mcpServers: listOf(init.mcp_servers, (item) => ({
      name: String(item.name),
      status: String(item.status),
    })),
    plugins: listOf(init.plugins, (item) => ({ name: String(item.name), path: String(item.path) })),
    skills: Array.isArray(init.skills)
      ? init.skills.filter((skill): skill is string => typeof skill === "string")
      : [],
    result:
      result === undefined
        ? undefined
        : { subtype: String(result.subtype), isError: result.is_error === true },
  };
};
