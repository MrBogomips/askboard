import { describe, expect, test } from "bun:test";
import { SERVER_INSTRUCTIONS, TOOL_DEFINITIONS, type ToolDefinition } from "@askboard/contract";
import { toolInputProblems } from "@askboard/contract/validate";
import { listingProblems } from "../../src/mcp-tools/index.ts";
import { connect, depsWith, fakeCore, textOf } from "./helpers.ts";

// MCP adapter spec: Tool list; Server instructions for the tools listed (task 5.1).

const FULL_NAME = (tool: string) => `mcp__plugin_askboard_askboard__${tool}`;
const LIMIT = 4_096;

describe("the tool list", () => {
  test("is exactly ask, update, collect and fetch, as the contract's copy of the approved definitions", async () => {
    const { client, close } = await connect(depsWith(fakeCore()).deps);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(["ask", "update", "collect", "fetch"]);
    expect(tools).toEqual(TOOL_DEFINITIONS as never);
    expect(await client.listTools()).toEqual({ tools } as never);
    await close();
  });

  test("each description and the instructions are within 4,096 characters, each full name 128", () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.description.length).toBeLessThanOrEqual(LIMIT);
      expect(FULL_NAME(tool.name).length).toBeLessThanOrEqual(128);
    }
    expect(SERVER_INSTRUCTIONS.length).toBeLessThanOrEqual(LIMIT);
    expect(listingProblems(TOOL_DEFINITIONS, SERVER_INSTRUCTIONS)).toEqual([]);
    expect(toolInputProblems(TOOL_DEFINITIONS)).toEqual([]);
  });

  test("a definition or instructions that grow too long fail the check", () => {
    const [ask] = TOOL_DEFINITIONS as [ToolDefinition];
    const long = { ...ask, name: "a".repeat(98), description: "x".repeat(LIMIT + 1) };
    expect(listingProblems([long], "y".repeat(LIMIT + 1))).toEqual([
      `the description of ${long.name} has ${LIMIT + 1} characters, more than ${LIMIT}`,
      `the full name ${FULL_NAME(long.name)} has 129 characters, more than 128`,
      `the server instructions have ${LIMIT + 1} characters, more than ${LIMIT}`,
    ]);
  });

  test("an unknown tool is an error naming the tools AskBoard lists", async () => {
    const { client, close } = await connect(depsWith(fakeCore()).deps);
    const result = await client.callTool({ name: "snapshot", arguments: {} });
    expect(result.isError).toBe(true);
    for (const tool of ["ask", "update", "collect", "fetch"]) {
      expect(textOf(result)).toContain(tool);
    }
    await close();
  });
});

describe("the server instructions", () => {
  test("are the contract's approved instructions, which name no tool that is not listed", async () => {
    const { client, close } = await connect(depsWith(fakeCore()).deps);
    expect(client.getInstructions()).toBe(SERVER_INSTRUCTIONS);
    expect(client.getInstructions()).not.toMatch(/`snapshot`/);
    expect(client.getServerVersion()).toMatchObject({ name: "askboard" });
    await close();
  });
});
