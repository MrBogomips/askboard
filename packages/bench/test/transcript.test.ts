import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findTranscripts, parseInit, parseTranscript, projectsRoot } from "../src/transcript.ts";
import { TranscriptBuilder } from "./support/transcript-builder.ts";

const T0 = Date.parse("2026-10-30T10:00:00.000Z");

describe("parseTranscript", () => {
  test("groups a response's entries by requestId and counts its usage once", () => {
    const builder = new TranscriptBuilder({ start: T0, effort: "medium" });
    builder.prompt("ask me", T0);
    const [search] = builder.request(
      { input: 10, cacheCreation: 1_000, cacheRead: 0, output: 300, thinking: 120 },
      [
        { type: "thinking" },
        { type: "text", text: "Searching." },
        { type: "tool_use", name: "ToolSearch", input: { query: "askboard" } },
      ],
      T0 + 1_000,
    );
    builder.toolResult(search ?? "", "found", { at: T0 + 4_000 });
    builder.request(
      { input: 5, cacheRead: 1_400, output: 50, thinking: 0 },
      [{ type: "text", text: "done" }],
      T0 + 5_000,
    );
    const transcript = parseTranscript(builder.text());
    expect(transcript.requests).toHaveLength(2);
    const [first, second] = transcript.requests;
    expect(first).toMatchObject({
      key: "req_1",
      index: 0,
      start: T0,
      output: 300,
      thinking: 120,
      totalInput: 1_010,
      hasText: true,
      calls: [{ id: search, name: "ToolSearch", input: { query: "askboard" }, at: T0 + 1_200 }],
    });
    expect(second).toMatchObject({
      start: T0 + 4_000,
      totalInput: 1_405,
      calls: [],
      hasText: true,
    });
    expect(transcript.results.get(search ?? "")).toEqual({
      at: T0 + 4_000,
      isError: false,
      text: "found",
    });
    expect(transcript.observed).toEqual({
      versions: ["2.1.314"],
      models: ["claude-opus-5-5"],
      efforts: ["medium"],
      cacheWrites: { "5m": 1_000, "1h": 0 },
    });
  });

  test("a request whose entry has no parent starts at the entry before it", () => {
    const text = [
      {
        type: "user",
        uuid: "a",
        parentUuid: null,
        timestamp: "2026-10-30T10:00:00Z",
        message: { content: "hi" },
      },
      {
        type: "assistant",
        uuid: "b",
        parentUuid: "missing",
        requestId: "r",
        timestamp: "2026-10-30T10:00:02Z",
        message: {
          id: "m",
          content: [{ type: "text", text: "x" }],
          usage: { input_tokens: 1, output_tokens: 2 },
        },
      },
    ]
      .map((row) => JSON.stringify(row))
      .join("\n");
    const [request] = parseTranscript(text).requests;
    expect(request?.start).toBe(Date.parse("2026-10-30T10:00:00Z"));
    expect(request?.thinking).toBeUndefined();
    expect(request?.totalInput).toBe(1);
  });

  test("falls back to the message ID, takes the largest usage, and skips lines it cannot read", () => {
    const row = (output: number, uuid: string) =>
      JSON.stringify({
        type: "assistant",
        uuid,
        timestamp: "2026-10-30T10:00:01Z",
        message: {
          id: "msg_x",
          content: [{ type: "text", text: "a" }],
          usage: { input_tokens: 1, output_tokens: output },
        },
      });
    const transcript = parseTranscript(`${row(5, "a")}\nnot json\n\n${row(9, "b")}\n`);
    expect(transcript.requests).toEqual([expect.objectContaining({ key: "msg_x", output: 9 })]);
  });

  test("a tool result's text, from a string or text blocks, and its error flag", () => {
    const builder = new TranscriptBuilder({ start: T0 });
    builder.toolResult("toolu_a", "bad input", { isError: true });
    const rows = builder.text();
    const extra = JSON.stringify({
      type: "user",
      uuid: "z",
      timestamp: "2026-10-30T10:00:09Z",
      message: { content: [{ type: "tool_result", tool_use_id: "toolu_b", content: "plain" }] },
    });
    const transcript = parseTranscript(`${rows}${extra}\n`);
    expect(transcript.results.get("toolu_a")).toMatchObject({ isError: true, text: "bad input" });
    expect(transcript.results.get("toolu_b")).toMatchObject({ isError: false, text: "plain" });
  });

  test("a transcript without thinking or cache fields reports them as not observed", () => {
    const builder = new TranscriptBuilder({ start: T0, withoutThinking: true });
    builder.request({ input: 3, output: 7 }, [{ type: "text", text: "x" }]);
    const transcript = parseTranscript(builder.text());
    expect(transcript.requests[0]?.thinking).toBeUndefined();
    expect(transcript.observed.efforts).toEqual([]);
  });
});

describe("finding transcripts", () => {
  test("by session ID under any project folder, with its subagents", () => {
    const root = mkdtempSync(join(tmpdir(), "bench-projects-"));
    mkdirSync(join(root, "-tmp-a", "sid-1", "subagents"), { recursive: true });
    mkdirSync(join(root, "-tmp-b"));
    writeFileSync(join(root, "-tmp-a", "sid-1.jsonl"), "");
    writeFileSync(join(root, "-tmp-a", "sid-1", "subagents", "agent-x.jsonl"), "");
    writeFileSync(join(root, "-tmp-a", "sid-1", "subagents", "notes.txt"), "");
    writeFileSync(join(root, "-tmp-b", "sid-2.jsonl"), "");
    expect(findTranscripts(root, "sid-1")).toEqual({
      main: join(root, "-tmp-a", "sid-1.jsonl"),
      subagents: [join(root, "-tmp-a", "sid-1", "subagents", "agent-x.jsonl")],
    });
    expect(findTranscripts(root, "sid-3")).toEqual({ main: undefined, subagents: [] });
    expect(findTranscripts(join(root, "absent"), "sid-1")).toEqual({
      main: undefined,
      subagents: [],
    });
  });

  test("the projects folder follows CLAUDE_CONFIG_DIR, else the home folder", () => {
    expect(projectsRoot({ CLAUDE_CONFIG_DIR: "/c" }, "/home/u")).toBe("/c/projects");
    expect(projectsRoot({}, "/home/u")).toBe("/home/u/.claude/projects");
  });
});

describe("parseInit", () => {
  test("reads the system init message of stream-json output", () => {
    const stream = [
      JSON.stringify({
        type: "system",
        subtype: "init",
        model: "claude-opus-5-5",
        claude_code_version: "2.1.314",
        tools: ["ToolSearch", "mcp__plugin_askboard_askboard__ask"],
        mcp_servers: [
          { name: "plugin:askboard:askboard", status: "connected" },
          { name: "claude.ai Docs", status: "connected" },
        ],
        plugins: [{ name: "askboard", path: "/repo" }],
      }),
      "garbage",
      JSON.stringify({ type: "result", subtype: "success", is_error: false, num_turns: 6 }),
    ].join("\n");
    expect(parseInit(stream)).toEqual({
      model: "claude-opus-5-5",
      version: "2.1.314",
      tools: ["ToolSearch", "mcp__plugin_askboard_askboard__ask"],
      mcpServers: [
        { name: "plugin:askboard:askboard", status: "connected" },
        { name: "claude.ai Docs", status: "connected" },
      ],
      plugins: [{ name: "askboard", path: "/repo" }],
      result: { subtype: "success", isError: false },
    });
    expect(parseInit("")).toBeUndefined();
  });
});
