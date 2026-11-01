import { describe, expect, test } from "bun:test";
import { CLAUDE_CODE_CLIENT_NAME, SCHEMA_IDS } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { validateAgainst } from "@askboard/contract/validate";
import type { Binding } from "@askboard/core";
import {
  ASK_ID,
  type ClientOptions,
  connect,
  depsWith,
  EPOCH,
  type FakeCore,
  fakeCore,
  jsonOf,
} from "./helpers.ts";

// Push delivery's wiring of the tools (task 4.7; mcp-adapter spec, A session without hooks and
// Supported Claude Code versions): each call's identity for its agent record, the binding passed
// to every read, the no-hooks warning and the unchecked mark only on unchecked asks, and the
// client version from the protocol's client information.

const [question] = plainChoiceBoardDocument.items;
const plainChoice = {
  askId: ASK_ID,
  items: [{ type: question.type, id: question.id, props: question.props }],
};
const OTHER_ID = "cache-choice-b5n1";
const TOOL_USE_ID = "toolu_01HqVb7cXz9KpL3mN5rT8wYe";
const OWNER: Binding = { ownerKey: "owner-1" };

const callTool = async (
  core: FakeCore,
  name: string,
  args: unknown,
  meta?: Record<string, unknown>,
  client: ClientOptions = {},
) => {
  const { client: connected, close } = await connect(depsWith(core).deps, client);
  const result = await connected.callTool({
    name,
    arguments: args as never,
    ...(meta === undefined ? {} : { _meta: meta }),
  });
  await close();
  return result;
};

describe("the call identity", () => {
  test("an ask passes the toolUseId of its _meta, the tool and its ask ID", async () => {
    const core = fakeCore();
    await callTool(core, "ask", plainChoice, { "claudecode/toolUseId": TOOL_USE_ID });
    expect(core.identities).toEqual([{ toolUseId: TOOL_USE_ID, tool: "ask", askIds: [ASK_ID] }]);
  });

  test("without a usable toolUseId the identity has none, and an ask with no ID names none", async () => {
    const core = fakeCore();
    await callTool(core, "ask", plainChoice);
    await callTool(core, "ask", { items: [] }, { "claudecode/toolUseId": "" });
    await callTool(core, "ask", { askId: 7 }, { "claudecode/toolUseId": "x".repeat(257) });
    await callTool(core, "ask", plainChoice, { "claudecode/toolUseId": 12 });
    expect(core.identities).toEqual([
      { tool: "ask", askIds: [ASK_ID] },
      { tool: "ask", askIds: [] },
      { tool: "ask", askIds: [] },
      { tool: "ask", askIds: [ASK_ID] },
    ]);
  });

  test("a collect binds once, with every ask ID, and passes the binding to each read", async () => {
    const core = fakeCore({ binding: OWNER });
    await callTool(
      core,
      "collect",
      {
        asks: [
          { askId: ASK_ID, after: `${EPOCH}.0` },
          { askId: OTHER_ID, after: `${EPOCH}.0` },
        ],
      },
      { "claudecode/toolUseId": TOOL_USE_ID },
    );
    expect(core.calls.filter((call) => call === "bind")).toHaveLength(1);
    expect(core.identities).toEqual([
      { toolUseId: TOOL_USE_ID, tool: "collect", askIds: [ASK_ID, OTHER_ID] },
    ]);
    expect(core.bindings).toEqual([OWNER, OWNER]);
  });

  test("a collect refused for its shape binds nothing", async () => {
    const core = fakeCore({ binding: OWNER });
    await callTool(core, "collect", { asks: [] });
    expect(core.calls).not.toContain("bind");
  });
});

describe("the no-hooks warning and the unchecked mark", () => {
  test("an ask bound to its record carries no warning", async () => {
    const core = fakeCore({ owners: { [ASK_ID]: OWNER } });
    const json = jsonOf(await callTool(core, "ask", plainChoice)) as Record<string, unknown>;
    expect(json).not.toHaveProperty("warnings");
    expect(validateAgainst(SCHEMA_IDS.askResult, json).ok).toBe(true);
  });

  test("an unchecked ask carries it", async () => {
    const json = jsonOf(await callTool(fakeCore(), "ask", plainChoice)) as { warnings: unknown[] };
    expect(json.warnings).toEqual([{ code: "no-hooks", message: expect.any(String) }]);
  });

  test("a collect marks each unchecked ask and no owned one", async () => {
    const core = fakeCore({ owners: { [ASK_ID]: OWNER }, binding: OWNER });
    const json = jsonOf(
      await callTool(core, "collect", {
        asks: [
          { askId: ASK_ID, after: `${EPOCH}.0` },
          { askId: OTHER_ID, after: `${EPOCH}.0` },
        ],
      }),
    ) as { asks: Record<string, unknown>[] };
    expect(json.asks.map((entry) => entry.unchecked)).toEqual([undefined, true]);
    expect(validateAgainst(SCHEMA_IDS.collectResult, json).ok).toBe(true);
  });

  test("an ask of another epoch, reported discarded, stays marked unchecked", async () => {
    const core = fakeCore({
      owners: { [ASK_ID]: OWNER },
      read: (askId, after) => ({ kind: "discarded", askId, cursor: after }),
    });
    const json = jsonOf(
      await callTool(core, "collect", { asks: [{ askId: ASK_ID, after: "q8w2zz11.1" }] }),
    ) as { asks: Record<string, unknown>[] };
    expect(json.asks[0]).toMatchObject({ state: "discarded", unchecked: true });
  });
});

describe("the client version", () => {
  test("comes from the per-request client information when the client is Claude Code", async () => {
    const core = fakeCore();
    await callTool(core, "ask", plainChoice, undefined, {
      name: CLAUDE_CODE_CLIENT_NAME,
      version: "2.1.312",
      negotiation: "auto",
    });
    expect(core.versions).toEqual(["client-info 2.1.312"]);
  });

  test("comes from initialize's client information on the legacy handshake", async () => {
    const core = fakeCore();
    await callTool(core, "collect", { asks: [{ askId: ASK_ID, after: `${EPOCH}.0` }] }, undefined, {
      name: CLAUDE_CODE_CLIENT_NAME,
      version: "2.1.308",
      negotiation: "legacy",
    });
    expect(core.versions).toEqual(["client-info 2.1.308"]);
  });

  test("another client sets none", async () => {
    const core = fakeCore();
    for (const negotiation of ["auto", "legacy"] as const) {
      await callTool(core, "ask", plainChoice, undefined, {
        name: "askboard-conformance",
        version: "2.1.312",
        negotiation,
      });
    }
    expect(core.versions).toEqual([]);
  });
});
