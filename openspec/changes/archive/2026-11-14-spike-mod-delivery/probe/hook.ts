// Settings hooks for PreToolUse, PostToolUse and SubagentStop: log the input, send agent records,
// show the board link, and run the stop guard. Never blocks a tool call; always exits 0 (AD-19).
import { api, findSessionFile, findSessionFileByParent, logTo, readStdin } from "./lib.ts";

const event = process.argv[2] ?? "unknown";
const LOG = "hooks.jsonl";

type HookInput = {
  session_id?: string;
  cwd?: string;
  agent_id?: string;
  agent_type?: string;
  tool_name?: string;
  tool_use_id?: string;
  tool_input?: { askId?: string };
  tool_response?: unknown;
  stop_hook_active?: boolean;
  [key: string]: unknown;
};

async function main(): Promise<void> {
  const input = JSON.parse((await readStdin()) || "{}") as HookInput;
  const envKey = process.env.CLAUDE_CODE_SESSION_ID;
  const byKey = findSessionFile(envKey);
  const byParent = byKey.file ? undefined : findSessionFileByParent(process.ppid);
  const file = byKey.file ?? byParent?.file;
  const candidates = byKey.candidates;
  logTo(LOG, {
    event,
    ppid: process.ppid,
    env: { CLAUDE_CODE_SESSION_ID: envKey ?? null, CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR ?? null },
    sessionFile: byKey.file ? "found" : byParent?.file ? "found by parent pid" : `none (${candidates} candidates)`,
    input,
  });
  if (!file) {
    process.stderr.write(`probe hook ${event}: no session file for this session\n`);
    return;
  }
  if (event === "PreToolUse") {
    await api(file, "POST", "/record", {
      tool_use_id: input.tool_use_id,
      agent_id: input.agent_id,
      agent_type: input.agent_type,
      cwd: input.cwd,
      session_id: input.session_id,
      tool_name: input.tool_name,
      askId: input.tool_input?.askId,
    });
  } else if (event === "PostToolUse" && input.tool_name?.endsWith("__probe_ask")) {
    // Criterion 8 [F6]: is a systemMessage from a subagent's call shown to the user?
    const askId = input.tool_input?.askId ?? "?";
    process.stdout.write(JSON.stringify({ systemMessage: `probe board for ${askId}: ${file.apiAddress}/b/${askId}` }));
  } else if (event === "SubagentStop") {
    const { pending } = (await api(file, "POST", "/stop", { agent_id: input.agent_id })) as { pending: { nonce: string; text: string }[] };
    const shouldBlock = pending.length > 0 && input.stop_hook_active !== true;
    logTo(LOG, { event, decision: shouldBlock ? "block" : "allow", pending: pending.length, stop_hook_active: input.stop_hook_active ?? null });
    if (shouldBlock) {
      const lines = pending.map((p) => `${p.nonce}: ${p.text}`).join("\n");
      process.stdout.write(JSON.stringify({ decision: "block", reason: `Probe answers not yet received:\n${lines}` }));
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  logTo(LOG, { event, error: message });
  process.stderr.write(`probe hook ${event}: ${message}\n`);
});
