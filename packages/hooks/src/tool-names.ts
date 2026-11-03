// AskBoard's tool names as Claude Code gives them to hooks (Consistency Conventions, MCP names):
// `mcp__plugin_askboard_askboard__<tool>` from the plugin, and `mcp__askboard__<tool>` from an MCP
// configuration that names the server `askboard`.

/** The two prefixes of AskBoard's full tool names. */
export const ASKBOARD_TOOL_PREFIXES = [
  "mcp__plugin_askboard_askboard__",
  "mcp__askboard__",
] as const;

/** The tool Claude Code asks the user with, which the asking rule may send to AskBoard. */
export const ASK_USER_QUESTION = "AskUserQuestion";

/** The AskBoard tool a full name names, such as `ask`; undefined for any other tool. */
export const askBoardTool = (toolName: unknown): string | undefined => {
  if (typeof toolName !== "string") return undefined;
  for (const prefix of ASKBOARD_TOOL_PREFIXES) {
    if (toolName.startsWith(prefix) && toolName.length > prefix.length) {
      return toolName.slice(prefix.length);
    }
  }
  return undefined;
};
