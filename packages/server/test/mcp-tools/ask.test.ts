import { describe, expect, test } from "bun:test";
import { ERROR_TEXT_MAX_CHARS, RESULT_VERSIONS, SCHEMA_IDS } from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { type RequestProblem, validateAgainst } from "@askboard/contract/validate";
import { AskCore } from "@askboard/core";
import { ASK_ID, connect, depsWith, EPOCH, fakeCore, jsonOf, LINK, textOf } from "./helpers.ts";

// MCP adapter spec: Validation errors, The ask result, A session without hooks, No board can be
// shown (task 5.2).

const [question] = plainChoiceBoardDocument.items;
const plainChoice = {
  askId: ASK_ID,
  items: [{ type: question.type, id: question.id, props: question.props }],
};

const call = async (core: Parameters<typeof depsWith>[0], args: unknown) => {
  const { deps, written } = depsWith(core);
  const { client, close } = await connect(deps);
  const result = await client.callTool({ name: "ask", arguments: args as never });
  await close();
  return { result, written };
};

const problem = (n: number, itemId = "database"): RequestProblem => ({
  path: `/items/0/props/options/${n}/label`,
  itemId,
  field: `props.options[${n}].label`,
  expected: "non-empty text, unique within the question",
  message: `item "${itemId}", props.options[${n}].label must be non-empty text, unique within the question`,
});

describe("the ask result", () => {
  test("a created ask returns at once its versions, epoch, state, first cursor and board", async () => {
    const { result } = await call(fakeCore(), plainChoice);
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result);
    expect(json).toEqual({
      versions: RESULT_VERSIONS,
      epoch: EPOCH,
      askId: ASK_ID,
      state: "waiting",
      cursor: `${EPOCH}.0`,
      board: LINK,
      warnings: [{ code: "no-hooks", message: expect.any(String) }],
    });
    expect(validateAgainst(SCHEMA_IDS.askResult, json).ok).toBe(true);
  });

  test("the no-hooks warning says what is unavailable and that the agent must collect", async () => {
    const { result } = await call(fakeCore(), plainChoice);
    const [warning] = (jsonOf(result) as { warnings: { message: string }[] }).warnings;
    expect(warning?.message).toMatch(/push/);
    expect(warning?.message).toMatch(/ownership/);
    expect(warning?.message).toMatch(/stop guard/);
    expect(warning?.message).toMatch(/collect.*before you finish/);
  });

  test("a resend returns the same result", async () => {
    const resent = fakeCore({
      ask: async () => ({
        kind: "resent",
        ask: { askId: ASK_ID, state: "answered", cursor: `${EPOCH}.0`, board: LINK },
      }),
    });
    expect(jsonOf((await call(resent, plainChoice)).result)).toMatchObject({
      state: "answered",
      cursor: `${EPOCH}.0`,
      board: LINK,
    });
  });

  test("absent arguments are validated as an empty ask", async () => {
    const seen: unknown[] = [];
    const core = fakeCore({
      ask: async (request) => {
        seen.push(request);
        return { kind: "invalid", problems: [problem(0)] };
      },
    });
    await call(core, undefined);
    expect(seen).toEqual([{}]);
  });
});

describe("validation errors", () => {
  test("name the item ID and the expected shape, under 4,000 characters", async () => {
    const core = fakeCore({ ask: async () => ({ kind: "invalid", problems: [problem(1)] }) });
    const { result } = await call(core, plainChoice);
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toStartWith("The ask was not created");
    expect(text).toContain('item "database", props.options[1].label');
    expect(text).toContain("non-empty text, unique within the question");
  });

  test("with many problems, the first come first and a count stands for the rest", async () => {
    const many = Array.from({ length: 200 }, (_, n) => problem(n));
    const core = fakeCore({ ask: async () => ({ kind: "invalid", problems: many }) });
    const text = textOf((await call(core, plainChoice)).result);
    expect(text.length).toBeLessThan(ERROR_TEXT_MAX_CHARS);
    const lines = text.split("\n");
    expect(lines[1]).toContain("props.options[0].label");
    expect(lines[2]).toContain("props.options[1].label");
    const shown = lines.filter((line) => line.startsWith("- item")).length;
    expect(lines.at(-1)).toStartWith(`- and ${200 - shown} more problems`);
  });

  test("one very long problem does not crowd out the others", async () => {
    const long = { ...problem(0), message: `item "database", ${"x".repeat(10_000)}` };
    const core = fakeCore({ ask: async () => ({ kind: "invalid", problems: [long, problem(1)] }) });
    const text = textOf((await call(core, plainChoice)).result);
    expect(text.length).toBeLessThan(ERROR_TEXT_MAX_CHARS);
    expect(text).toContain("props.options[1].label");
  });

  test("once the session is ending, an ask is refused", async () => {
    const core = fakeCore({ ask: async () => ({ kind: "ending" }) });
    const { result } = await call(core, plainChoice);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("ending");
  });

  test("an ID in use is refused, naming it", async () => {
    const core = fakeCore({ ask: async () => ({ kind: "in-use", askId: ASK_ID }) });
    const { result } = await call(core, plainChoice);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`"${ASK_ID}" is in use`);
  });

  test("a failure inside AskBoard is an error that creates nothing, and stderr names no content", async () => {
    const core = fakeCore({
      ask: async () => {
        throw Object.assign(new Error(`no free port for ${LINK}`), { code: "EADDRINUSE" });
      },
    });
    const { result, written } = await call(core, plainChoice);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("created nothing");
    expect(written).toEqual(["askboard: ask failed: Error (EADDRINUSE)"]);
  });
});

describe("no board can be shown", () => {
  test("the result is unavailable with its reason, and the real core creates nothing", async () => {
    const opened: string[] = [];
    const links: string[] = [];
    const core = new AskCore({
      randomness: { bytes: (count) => new Uint8Array(count).fill(7) },
      showing: {
        check: async () => ({
          showable: false,
          reason: "remote-host",
          detail: "SSH_CONNECTION is set",
        }),
        open: (link) => opened.push(link),
      },
      address: {
        link: async (askId) => {
          links.push(askId);
          return LINK;
        },
      },
      identity: { gitUserName: async () => undefined, loginName: async () => "paola" },
      report: () => undefined,
    });
    const { result } = await call(core, plainChoice);
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result);
    expect(json).toEqual({
      versions: RESULT_VERSIONS,
      epoch: core.epoch,
      askId: ASK_ID,
      outcome: "unavailable",
      reason: "remote-host",
      message: expect.stringContaining("remote host"),
    });
    expect((json as { message: string }).message).toContain("AskUserQuestion");
    expect(validateAgainst(SCHEMA_IDS.askUnavailable, json).ok).toBe(true);
    expect(core.board(ASK_ID)).toBeUndefined();
    expect(links).toEqual([]);
    expect(opened).toEqual([]);
  });

  test.each([
    ["container", "/.dockerenv exists", "container"],
    ["ci", "CI is set and BROWSER is not", "CI runner"],
    ["no-browser", "no opener on PATH", "browser"],
  ] as const)("the reason %s is worded for the agent", async (reason, detail, words) => {
    const core = fakeCore({
      ask: async () => ({ kind: "unavailable", askId: ASK_ID, reason, detail }),
    });
    const json = jsonOf((await call(core, plainChoice)).result) as {
      reason: string;
      message: string;
    };
    expect(json.reason).toBe(reason);
    expect(json.message).toContain(words);
    expect(json.message).toContain(detail);
  });
});
