import { afterEach, describe, expect, test } from "bun:test";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import { Agent, askResultOf, collectedAskOf, toolJson } from "./agent.ts";
import { ChildTransport } from "./child.ts";
import { FakeChild, type FakeTool, fakeMcpServer } from "./fake-child.ts";

const { epoch, askId, link } = PLAIN_CHOICE;
const VERSIONS = { result: "1.0", output: "1.0" };
const ASK_RESULT = {
  versions: VERSIONS,
  epoch,
  askId,
  state: "waiting",
  cursor: `${epoch}.0`,
  board: link,
  warnings: [{ code: "no-hooks", message: "..." }],
};
const ANSWER = { cursor: `${epoch}.1`, type: "answer", itemId: "database", rev: 1 };
const COLLECT_RESULT = {
  versions: VERSIONS,
  epoch,
  asks: [{ askId, state: "answered", cursor: `${epoch}.1`, events: [ANSWER], unchecked: true }],
};

const agents: Agent[] = [];
afterEach(async () => {
  for (const agent of agents.splice(0)) await agent.close();
});

const connect = async (tools: Readonly<Record<string, FakeTool>>) => {
  const child = new FakeChild(fakeMcpServer(tools));
  const agent = await Agent.connect(new ChildTransport(child));
  agents.push(agent);
  return { agent, child };
};

const json = (value: unknown) => () => ({ text: JSON.stringify(value) });

describe("Agent", () => {
  test("initializes, then sends the ask as the agent wrote it and reads its result", async () => {
    const { agent, child } = await connect({ ask: json(ASK_RESULT) });
    const input = { askId, items: [] };
    expect(await agent.ask(input)).toEqual({
      epoch,
      askId,
      state: "waiting",
      cursor: `${epoch}.0`,
      board: link,
      warnings: [{ code: "no-hooks", message: "..." }],
    });
    const methods = child.received.map((message) => ("method" in message ? message.method : ""));
    expect(methods).toEqual(["initialize", "notifications/initialized", "tools/call"]);
    const call = child.received[2];
    expect(call && "params" in call ? call.params : undefined).toEqual({
      name: "ask",
      arguments: input,
    });
  });

  test("collects after a cursor and reads the ask's entry", async () => {
    let args: unknown;
    const { agent } = await connect({
      collect: (given) => {
        args = given;
        return { text: JSON.stringify(COLLECT_RESULT) };
      },
    });
    expect(await agent.collect(askId, `${epoch}.0`)).toEqual({
      askId,
      state: "answered",
      cursor: `${epoch}.1`,
      events: [ANSWER],
    });
    expect(args).toEqual({ asks: [{ askId, after: `${epoch}.0` }] });
  });

  test("lists the tools, waits in collect on a question, and sends an update", async () => {
    const received: Record<string, unknown> = {};
    const { agent } = await connect({
      collect: (given) => {
        received.collect = given;
        return { text: JSON.stringify(COLLECT_RESULT) };
      },
      update: (given) => {
        received.update = given;
        return { text: JSON.stringify({ versions: VERSIONS, epoch, askId, applied: [] }) };
      },
    });
    expect(await agent.listTools()).toEqual(["collect", "update"]);
    expect(await agent.collectWaiting(askId, `${epoch}.0`, "database")).toMatchObject({
      askId,
      state: "answered",
    });
    expect(received.collect).toEqual({
      asks: [{ askId, after: `${epoch}.0` }],
      wait: { askId, itemId: "database" },
    });
    const actions = [{ type: "close" }];
    expect(await agent.update(askId, actions)).toEqual({
      versions: VERSIONS,
      epoch,
      askId,
      applied: [],
    });
    expect(received.update).toEqual({ askId, actions });
  });

  test("fails on a protocol error, such as a tool the server does not have", async () => {
    const { agent } = await connect({});
    await expect(agent.collect(askId, `${epoch}.0`)).rejects.toThrow("no tools/call");
  });

  test("fails on an error result, quoting it", async () => {
    const { agent } = await connect({
      ask: () => ({ text: "database: options is required", isError: true }),
    });
    await expect(agent.ask({})).rejects.toThrow(
      "ask returned an error: database: options is required",
    );
  });
});

describe("toolJson", () => {
  test("reads the JSON of the one text block", () => {
    expect(toolJson("ask", { content: [{ type: "text", text: '{"a":1}' }] })).toEqual({ a: 1 });
  });

  test.each([
    ["no content", {}, "ask returned no text block"],
    ["a non-text block", { content: [{ type: "image" }] }, "ask returned no text block"],
    ["text that is not JSON", { content: [{ type: "text", text: "hi" }] }, "ask returned no JSON"],
  ])("fails on %s", (_, result, message) => {
    expect(() => toolJson("ask", result)).toThrow(message);
  });
});

describe("askResultOf", () => {
  test("fails on unavailable, naming the reason and where the target runs", () => {
    const unavailable = { versions: VERSIONS, epoch, askId, outcome: "unavailable" };
    expect(() =>
      askResultOf({ ...unavailable, reason: "container", message: "/.dockerenv exists" }),
    ).toThrow("no board can be shown (container: /.dockerenv exists)");
  });

  test("fails on a result without its board link, naming the field", () => {
    const { board: _, ...rest } = ASK_RESULT;
    expect(() => askResultOf(rest)).toThrow('the ask result has no "board"');
  });
});

describe("collectedAskOf", () => {
  test("fails when the result has no entry for the ask", () => {
    expect(() => collectedAskOf({ ...COLLECT_RESULT, asks: [] }, askId)).toThrow(
      `the collect result has no entry for ${askId}`,
    );
    expect(() => collectedAskOf({}, askId)).toThrow(`the collect result has no entry for ${askId}`);
  });

  test("fails on an entry without its events", () => {
    const [entry] = COLLECT_RESULT.asks;
    expect(() => collectedAskOf({ asks: [{ ...entry, events: "none" }] }, askId)).toThrow(
      'the collect result for order-db-choice-x7k2 has no "events"',
    );
  });
});
