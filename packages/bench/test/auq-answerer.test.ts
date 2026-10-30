import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { startServer } from "../src/agent.ts";
import { answeredInput, approve, hookOutput } from "../src/answerer/auq.ts";
import {
  PERMISSION_HOST,
  PERMISSION_TOOL,
  PERMISSION_TOOL_NAME,
  permissionServer,
} from "../src/answerer/permission-host.ts";
import { answerPlan, CASES, QUESTIONS } from "../src/scenarios.ts";

const plan = answerPlan(CASES.S1);
const auqQuestion = (index: number) => {
  const question = QUESTIONS[index];
  if (question === undefined) throw new Error("no question");
  return {
    question: question.text,
    header: question.header,
    multiSelect: false,
    options: question.options,
  };
};
const hookInput = (questions: unknown[]) => ({
  session_id: "s",
  transcript_path: "/t.jsonl",
  cwd: "/p",
  hook_event_name: "PreToolUse",
  tool_name: "AskUserQuestion",
  tool_input: { questions },
  tool_use_id: "toolu_01",
});

describe("the AskUserQuestion answerer", () => {
  test("answers each question with the plan's label, keyed by its text", () => {
    const { input, matched } = answeredInput({ questions: [auqQuestion(0), auqQuestion(1)] }, plan);
    expect(input).toEqual({
      questions: [auqQuestion(0), auqQuestion(1)],
      answers: {
        [auqQuestion(0).question]: "PostgreSQL",
        [auqQuestion(1).question]: "Flyway",
      },
    });
    expect(matched).toEqual([true, true]);
  });

  test("a question outside the plan gets its first option, unmatched; existing answers stay", () => {
    const other = { question: "Which cache?", options: [{ label: "Redis" }, { label: "None" }] };
    expect(answeredInput({ questions: [other] }, plan)).toEqual({
      input: { questions: [other], answers: { "Which cache?": "Redis" } },
      matched: [false],
    });
    const already = { questions: [other], answers: { "Which cache?": "None" } };
    expect(answeredInput(already, plan).input).toEqual(already);
  });

  test("the hook allows AskUserQuestion with the answers; other tools get no decision", () => {
    expect(hookOutput(hookInput([auqQuestion(0)]), plan)).toEqual({
      output: {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "benchmark: the scripted user answered",
          updatedInput: {
            questions: [auqQuestion(0)],
            answers: { [auqQuestion(0).question]: "PostgreSQL" },
          },
        },
      },
      record: { kind: "auq-hook", toolUseId: "toolu_01", questions: 1, matched: [true] },
    });
    expect(hookOutput({ ...hookInput([]), tool_name: "Bash" }, plan)).toEqual({
      output: undefined,
      record: undefined,
    });
    expect(hookOutput("nonsense", plan)).toEqual({ output: undefined, record: undefined });
  });

  test("the permission host allows AskUserQuestion with answers and denies anything else", () => {
    expect(
      approve({ tool_name: "AskUserQuestion", input: { questions: [auqQuestion(1)] } }, plan),
    ).toEqual({
      decision: {
        behavior: "allow",
        updatedInput: {
          questions: [auqQuestion(1)],
          answers: { [auqQuestion(1).question]: "Flyway" },
        },
      },
      record: { kind: "permission", tool: "AskUserQuestion", behavior: "allow" },
    });
    expect(approve({ tool_name: "Bash", input: { command: "ls" } }, plan)).toEqual({
      decision: { behavior: "deny", message: "the benchmark allows only AskUserQuestion here" },
      record: { kind: "permission", tool: "Bash", behavior: "deny" },
    });
  });
});

describe("the entries", () => {
  const files = () => {
    const dir = mkdtempSync(join(tmpdir(), "bench-auq-"));
    const planPath = join(dir, "plan.json");
    writeFileSync(planPath, JSON.stringify(plan));
    return { dir, planPath, records: join(dir, "answerer.jsonl") };
  };

  test("the hook entry reads stdin, prints its decision and appends a record without question text", async () => {
    const { planPath, records } = files();
    const child = Bun.spawn(
      [
        process.execPath,
        join(import.meta.dir, "../src/answerer/auq-hook-main.ts"),
        "--plan",
        planPath,
        "--records",
        records,
      ],
      { stdin: new Blob([JSON.stringify(hookInput([auqQuestion(0)]))]), stdout: "pipe" },
    );
    const printed = JSON.parse(await new Response(child.stdout).text());
    expect(await child.exited).toBe(0);
    expect(printed.hookSpecificOutput.updatedInput.answers).toEqual({
      [auqQuestion(0).question]: "PostgreSQL",
    });
    const text = readFileSync(records, "utf8");
    expect(JSON.parse(text)).toMatchObject({ kind: "auq-hook", toolUseId: "toolu_01" });
    expect(JSON.parse(text).at).toBeNumber();
    expect(text).not.toContain(auqQuestion(0).question);
  });

  test("the hook entry in process: a bad command line, and input that is not JSON", async () => {
    const { main } = await import("../src/answerer/auq-hook-main.ts");
    const { planPath, records } = files();
    const out: string[] = [];
    expect(await main(["--plan", planPath], "{}", (text) => out.push(text))).toBe(2);
    expect(
      await main(["--plan", planPath, "--records", records], "{oops", (text) => out.push(text)),
    ).toBe(0);
    expect(out).toEqual([]);
  });

  test("the hook entry in process: reads the input stream and prints the decision", async () => {
    const { run } = await import("../src/answerer/auq-hook-main.ts");
    const { planPath, records } = files();
    const printed: string[] = [];
    const input = Readable.from([JSON.stringify(hookInput([auqQuestion(1)]))]);
    const code = await run(["--plan", planPath, "--records", records], input, {
      write: (text: string) => printed.push(text),
    });
    expect(code).toBe(0);
    expect(JSON.parse(printed[0] ?? "").hookSpecificOutput.updatedInput.answers).toEqual({
      [auqQuestion(1).question]: "Flyway",
    });
    expect(JSON.parse(readFileSync(records, "utf8"))).toMatchObject({ matched: [true] });
  });

  test("the permission host's server, in process", async () => {
    const records: unknown[] = [];
    const server = permissionServer(plan, (entry) => records.push(entry));
    expect(PERMISSION_TOOL_NAME).toBe("mcp__bench__approve");
    expect(server.tools.map((tool) => tool.name)).toEqual([PERMISSION_TOOL]);
    const result = await server.call(PERMISSION_TOOL, { tool_name: "Write", input: {} }, undefined);
    expect(JSON.parse(result.content[0]?.text ?? "")).toMatchObject({ behavior: "deny" });
    expect(records).toEqual([{ kind: "permission", tool: "Write", behavior: "deny" }]);
  });

  test("the permission host serves approve over stdio", async () => {
    const { planPath, records } = files();
    const session = await startServer({
      command: process.execPath,
      args: [PERMISSION_HOST, "--plan", planPath, "--records", records],
      env: { PATH: process.env.PATH ?? "" },
    });
    expect(await session.listTools()).toEqual([PERMISSION_TOOL]);
    const result = await session.call(PERMISSION_TOOL, {
      tool_name: "AskUserQuestion",
      input: { questions: [auqQuestion(0)] },
      tool_use_id: "toolu_02",
    });
    expect(JSON.parse(result.text)).toMatchObject({
      behavior: "allow",
      updatedInput: { answers: { [auqQuestion(0).question]: "PostgreSQL" } },
    });
    expect(await session.close()).toBe(0);
    expect(JSON.parse(readFileSync(records, "utf8"))).toMatchObject({
      kind: "permission",
      tool: "AskUserQuestion",
      behavior: "allow",
    });
  });
});
