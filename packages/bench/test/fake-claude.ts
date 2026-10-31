// A stand-in for `claude -p` (early-benchmark design decision 14): it answers --version, reads the
// questions from the prompt's fixed block, and acts as an agent would, with no model. In the
// AskBoard arm it starts the plugin's server and calls ask and collect; in the AskUserQuestion arm
// it runs the PreToolUse hook of the run's settings. It writes a transcript in the observed layout
// and the stream-json init and result lines. Test code.

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { startServer } from "../src/agent.ts";
import { readPluginServer } from "../src/plugin.ts";
import { projectsRoot } from "../src/transcript.ts";
import { TranscriptBuilder } from "./support/transcript-builder.ts";

const VERSION = "2.1.314";
const argv = process.argv.slice(2);
if (argv.includes("--version")) {
  process.stdout.write(`${VERSION} (Claude Code)\n`);
  process.exit(0);
}

const flag = (name: string): string | undefined => {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
};

type Question = { header: string; text: string; options: { label: string; description: string }[] };

const questionsOf = (prompt: string): Question[] =>
  prompt
    .split(/\n(?=Question \d+ \(single choice\))/)
    .filter((block) => block.startsWith("Question "))
    .map((block) => {
      const lines = block.split("\n");
      const value = (prefix: string) =>
        lines.find((line) => line.startsWith(prefix))?.slice(prefix.length) ?? "";
      const options = lines
        .filter((line) => line.startsWith("- "))
        .map((line) => {
          const [label = "", ...rest] = line.slice(2).split(": ");
          return { label, description: rest.join(": ") };
        });
      return { header: value("Header: "), text: value("Text: "), options };
    });

const prompt = flag("-p") ?? "";
const sessionId = flag("--session-id") ?? "no-session";
const pluginDir = flag("--plugin-dir");
const settingsPath = flag("--settings");
const model = flag("--model") ?? "claude-opus-5-5";
const effort = flag("--effort") ?? "medium";
const tools = (flag("--tools") ?? "").split(",").filter(Boolean);
const questions = questionsOf(prompt);
const fromSubagent = prompt.startsWith("Start one subagent");
const cwd = process.cwd();
const folder = join(projectsRoot(process.env, homedir()), cwd.replace(/[^A-Za-z0-9]/g, "-"));
mkdirSync(folder, { recursive: true });

const emit = (line: unknown) => process.stdout.write(`${JSON.stringify(line)}\n`);
emit({
  type: "system",
  subtype: "init",
  session_id: sessionId,
  model,
  claude_code_version: VERSION,
  tools,
  mcp_servers:
    pluginDir === undefined ? [] : [{ name: "plugin:askboard:askboard", status: "connected" }],
  plugins: pluginDir === undefined ? [] : [{ name: "askboard", path: pluginDir }],
});

let total = 20_000;
const usage = (output: number, thinking: number) => {
  const spec = { input: 5, cacheRead: total - 5, output, thinking };
  total += output + 100;
  return spec;
};

const main = new TranscriptBuilder({
  start: Date.now(),
  model,
  effort,
  sessionId,
  version: VERSION,
});
main.prompt(prompt, Date.now());
const agentId = randomBytes(8).toString("hex");
const asker = fromSubagent
  ? new TranscriptBuilder({
      start: Date.now(),
      model,
      effort,
      sessionId,
      version: VERSION,
      agentId,
    })
  : main;
let agentCall: string | undefined;
if (fromSubagent) {
  [agentCall] = main.request(
    usage(200, 40),
    [
      {
        type: "tool_use",
        name: "Agent",
        input: { subagent_type: "general-purpose", prompt: "task" },
      },
    ],
    Date.now(),
  );
  asker.prompt("task", Date.now());
}

const chosen: string[] = [];

const askboardArm = async (dir: string) => {
  const server = readPluginServer(dir, cwd);
  const session = await startServer({
    ...server,
    env: { ...(process.env as Record<string, string>), ...server.env },
    cwd,
  });
  try {
    for (const [index, question] of questions.entries()) {
      if (index === 0) {
        const [search] = asker.request(
          usage(150, 50),
          [{ type: "tool_use", name: "ToolSearch", input: { query: "askboard ask" } }],
          Date.now(),
        );
        asker.toolResult(search ?? "", "ask, collect", { at: Date.now() });
      }
      const input = {
        askId: `fake-${index}-${randomBytes(3).toString("hex")}`,
        items: [{ type: "question", id: `q${index}`, props: question }],
      };
      const [ask] = asker.request(
        usage(400, 100),
        [{ type: "tool_use", name: "mcp__plugin_askboard_askboard__ask", input }],
        Date.now(),
      );
      const asked = await session.call("ask", input);
      asker.toolResult(ask ?? "", asked.text, { isError: asked.isError, at: Date.now() });
      if (asked.isError) return;
      const result = JSON.parse(asked.text);
      const collectInput = {
        asks: [{ askId: input.askId, after: result.cursor }],
        wait: { askId: input.askId, itemId: `q${index}` },
      };
      const [collect] = asker.request(
        usage(90, 10),
        [{ type: "tool_use", name: "mcp__plugin_askboard_askboard__collect", input: collectInput }],
        Date.now(),
      );
      const collected = await session.call("collect", collectInput);
      asker.toolResult(collect ?? "", collected.text, {
        isError: collected.isError,
        at: Date.now(),
      });
      const event = JSON.parse(collected.text).asks?.[0]?.events?.[0];
      chosen.push(...(event?.choice ?? []));
    }
  } finally {
    await session.close();
  }
};

const auqArm = () => {
  const settings = JSON.parse(readFileSync(settingsPath ?? "", "utf8"));
  const command: string = settings.hooks.PreToolUse[0].hooks[0].command;
  for (const question of questions) {
    const input = {
      questions: [
        {
          question: question.text,
          header: question.header,
          multiSelect: false,
          options: question.options,
        },
      ],
    };
    const [call] = asker.request(
      usage(350, 90),
      [{ type: "tool_use", name: "AskUserQuestion", input }],
      Date.now(),
    );
    const hookInput = {
      session_id: sessionId,
      cwd,
      hook_event_name: "PreToolUse",
      tool_name: "AskUserQuestion",
      tool_input: input,
      tool_use_id: call,
    };
    const ran = spawnSync("sh", ["-c", command], {
      input: JSON.stringify(hookInput),
      encoding: "utf8",
    });
    const answers = JSON.parse(ran.stdout || "{}").hookSpecificOutput?.updatedInput?.answers ?? {};
    const answer = answers[question.text];
    chosen.push(answer);
    asker.toolResult(
      call ?? "",
      `User has answered your questions: "${question.text}"="${answer}". You can now continue.`,
      { at: Date.now() },
    );
  }
};

if (pluginDir !== undefined) await askboardArm(pluginDir);
else auqArm();

asker.request(usage(20, 0), [{ type: "text", text: chosen.join(", ") }], Date.now());
if (fromSubagent) {
  mkdirSync(join(folder, sessionId, "subagents"), { recursive: true });
  writeFileSync(join(folder, sessionId, "subagents", `agent-${agentId}.jsonl`), asker.text());
  main.toolResult(agentCall ?? "", chosen.join(", "), { at: Date.now() });
  main.request(usage(10, 0), [{ type: "text", text: chosen.join(", ") }], Date.now());
}
writeFileSync(join(folder, `${sessionId}.jsonl`), main.text());
emit({ type: "result", subtype: "success", is_error: false, num_turns: questions.length * 2 + 1 });
