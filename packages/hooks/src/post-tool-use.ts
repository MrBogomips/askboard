// The PostToolUse link (design decision 6; FR-23; Consistency Conventions, Board link and notice):
// after the main conversation's `ask` returns a board link, the user sees "AskBoard · <title> ·
// <link>" as a system message, with the title the session process holds, since the result carries
// none; or "AskBoard · <link>" when the session process cannot be reached. A subagent's message
// would land in its own transcript, out of the user's sight, so a subagent's ask gets nothing and
// costs no request; so do `unavailable`, an error and anything that is not an ask result.

import { type AskResult, agentTextPiece, noticePath, SCHEMA_IDS } from "@askboard/contract";
import { validateAgainst } from "@askboard/contract/validate";
import { describeFailure } from "./failure.ts";
import type { HookHandler } from "./runner.ts";
import { askBoardTool } from "./tool-names.ts";

const SEPARATOR = " · ";
const PREFIX = "AskBoard";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The text block of an MCP tool result: Claude Code gives its content blocks, or the result with
// them; a result marked as an error has none to read.
const textOf = (response: unknown): string | undefined => {
  if (typeof response === "string") return response;
  const content = isRecord(response)
    ? response.isError === true
      ? undefined
      : response.content
    : response;
  if (!Array.isArray(content)) return undefined;
  const block: unknown = content.find(
    (candidate: unknown) =>
      isRecord(candidate) && candidate.type === "text" && typeof candidate.text === "string",
  );
  return isRecord(block) ? (block.text as string) : undefined;
};

/** The ask result a tool response holds, checked against the contract; undefined otherwise. */
export const askResultOf = (response: unknown): AskResult | undefined => {
  const text = textOf(response);
  if (text === undefined) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  const checked = validateAgainst<AskResult>(SCHEMA_IDS.askResult, value);
  return checked.ok ? checked.value : undefined;
};

const shown = (...pieces: string[]) => ({ systemMessage: [PREFIX, ...pieces].join(SEPARATOR) });

export const postToolUse: HookHandler = async ({ input, localApi }) => {
  if (askBoardTool(input.tool_name) !== "ask") {
    return { problem: "AskBoard has no PostToolUse hook for this tool" };
  }
  const agentId = input.agent_id;
  if (typeof agentId === "string" && agentId !== "") return {};
  const result = askResultOf(input.tool_response);
  if (result === undefined) return {};
  const { board } = result;
  try {
    const notice = await localApi.exchange(
      { method: "GET", path: noticePath(result.askId) },
      "noticeResponse",
    );
    return { output: shown(agentTextPiece(notice.title), board) };
  } catch (error) {
    return { output: shown(board), problem: describeFailure(error) };
  }
};
