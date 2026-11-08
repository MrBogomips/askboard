import { describe, expect, test } from "bun:test";
import {
  ERROR_TEXT_MAX_CHARS,
  GANTT_MAX_PREDECESSORS,
  GANTT_MAX_TASKS,
  RESULT_MAX_CHARS,
  RESULT_VERSIONS,
  SCHEMA_IDS,
} from "@askboard/contract";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { type RequestProblem, validateAgainst } from "@askboard/contract/validate";
import { AskCore, BoardSetupError } from "@askboard/core";
import {
  ASK_ID,
  connect,
  depsWith,
  EPOCH,
  fakeCore,
  jsonOf,
  LINK,
  runtimeClock,
  textOf,
} from "./helpers.ts";

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

  // Core spec, Re-sending comes from the owner (task 13.7): resending cannot get another agent's
  // board, so the text sends the agent to a new ID rather than into a retry loop.
  test("another agent's identical ask is refused as in use, telling the agent to choose a new ID", async () => {
    const core = fakeCore({ ask: async () => ({ kind: "other-owner", askId: ASK_ID }) });
    const { result } = await call(core, plainChoice);
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain(`"${ASK_ID}" is in use`);
    expect(text).toContain("another agent's ask");
    expect(text).toContain("choose a new ID");
    expect(text).not.toContain("send the identical request again");
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

describe("a board setup that cannot serve boards", () => {
  test("is its own error, which asks for a rebuild and not a resend, with class and code on stderr", async () => {
    class ViewBuildError extends BoardSetupError {
      override readonly name = "ViewBuildError";
    }
    const core = fakeCore({
      ask: async () => {
        throw new ViewBuildError("VIEW_MANIFEST_UNREADABLE", `cannot read ${LINK}`);
      },
    });
    const { result, written } = await call(core, plainChoice);
    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain("view build is missing or damaged");
    expect(text).toContain("rebuild or reinstall AskBoard");
    expect(text).toContain("AskUserQuestion");
    expect(text).not.toContain("Send it again");
    expect(text).not.toContain(LINK);
    expect(written).toEqual(["askboard: ask failed: ViewBuildError (VIEW_MANIFEST_UNREADABLE)"]);
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
      clock: runtimeClock,
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

// Push delivery (tasks 3.2 and 3.5): the owner's resend and the version gate's refusal.

describe("refusals of push delivery", () => {
  test("an owned ask's resend from a call with no agent record may be retried, naming the ask", async () => {
    const core = fakeCore({ ask: async () => ({ kind: "no-record", askId: ASK_ID }) });
    const { result } = await call(core, plainChoice);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`"${ASK_ID}"`);
    expect(textOf(result)).toContain("no agent record");
    expect(textOf(result)).toContain("again");
  });

  test("a Claude Code below the minimum is refused, naming both versions", async () => {
    const core = fakeCore({
      ask: async () => ({
        kind: "unsupported-version",
        askId: ASK_ID,
        version: "2.1.308",
        minimum: "2.1.311",
      }),
    });
    const { result } = await call(core, plainChoice);
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("2.1.311");
    expect(textOf(result)).toContain("2.1.308");
    expect(textOf(result)).toContain("nothing was created");
  });
});

// Excerpts, task 4.1 (mcp-adapter spec, "Unresolved pointers in ask and update results").
describe("unresolved pointers", () => {
  const unresolved = [
    {
      code: "unresolved-pointer",
      itemId: "retry-adr",
      pointer: "docs/adr/0012-payment-retries.md#Decision",
      reason: "anchor-not-found",
      message: 'The file has no heading "Decision".',
    },
    {
      code: "unresolved-pointer",
      itemId: "shot",
      pointer: ".askboard/media/shot.png",
      reason: "not-found",
      message: "The file does not exist.",
    },
  ] as const;
  const created = (owned: boolean) =>
    fakeCore({
      ask: async () => ({
        kind: "created",
        ask: { askId: ASK_ID, state: "waiting", cursor: `${EPOCH}.0`, board: LINK },
        warnings: unresolved,
      }),
      ...(owned ? { owners: { [ASK_ID]: { ownerKey: "owner-1" } } } : {}),
    });

  test("an unchecked ask's result carries them after no-hooks, in order, and validates", async () => {
    const { result } = await call(created(false), plainChoice);
    expect(result.isError).toBeFalsy();
    const json = jsonOf(result) as { warnings: unknown[] };
    expect(json.warnings).toEqual([
      { code: "no-hooks", message: expect.any(String) },
      ...unresolved,
    ]);
    expect(validateAgainst(SCHEMA_IDS.askResult, json).ok).toBe(true);
  });

  test("an owned ask's result carries them alone", async () => {
    const { result } = await call(created(true), plainChoice);
    const json = jsonOf(result);
    expect((json as { warnings: unknown[] }).warnings).toEqual([...unresolved]);
    expect(validateAgainst(SCHEMA_IDS.askResult, json).ok).toBe(true);
  });

  test("an owned ask with every pointer resolved has no warnings", async () => {
    const core = fakeCore({ owners: { [ASK_ID]: { ownerKey: "owner-1" } } });
    expect(jsonOf((await call(core, plainChoice)).result)).not.toHaveProperty("warnings");
  });
});

// The core spec's "The worst plan the contract admits", through the tool: the whole result text,
// the `no-hooks` warning with the formula warnings, stays under the result limit (AD-6).
describe("the worst plan the contract admits", () => {
  const id = (kind: string, n: number) => `${kind}${String(n).padStart(64 - kind.length, "0")}`;
  const columns = ["optimistic", "mostLikely", "pessimistic"].map((field) => ({
    field,
    label: field,
    type: "number",
  }));
  const leaves = Array.from({ length: GANTT_MAX_TASKS }, (_, n) => id("l", n));
  const worst = {
    askId: ASK_ID,
    items: [
      {
        type: "question",
        id: "plan",
        props: {
          text: "Does this fit?",
          items: [
            {
              type: "tree",
              id: "wbs",
              props: {
                pert: true,
                columns,
                nodes: leaves.map((leaf) => ({
                  id: leaf,
                  label: "Leaf",
                  optimistic: 1,
                  mostLikely: 2,
                  pessimistic: 3,
                })),
              },
            },
            {
              type: "gantt",
              id: "schedule",
              props: {
                workPackages: "wbs",
                start: "2026-11-02",
                tasks: Object.fromEntries(
                  leaves.map((leaf, n) => [
                    leaf,
                    {
                      dependencies: Array.from({ length: GANTT_MAX_PREDECESSORS }, (_, k) =>
                        id("p", n * GANTT_MAX_PREDECESSORS + k),
                      ),
                    },
                  ]),
                ),
              },
            },
          ],
        },
      },
    ],
  };

  test("the ask tool's result text is under the result limit, with its no-hooks warning", async () => {
    const core = new AskCore({
      randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
      showing: { check: async () => ({ showable: true }), open: () => undefined },
      address: { link: async () => LINK },
      identity: { gitUserName: async () => undefined, loginName: async () => "paola" },
      report: () => undefined,
      clock: runtimeClock,
    });
    const { result } = await call(core, worst);
    expect(result.isError).toBeFalsy();
    expect(textOf(result).length).toBeLessThan(RESULT_MAX_CHARS);
    const json = jsonOf(result) as { warnings: { code: string; message: string }[] };
    expect(json.warnings[0]?.code).toBe("no-hooks");
    expect(json.warnings.at(-1)?.message).toMatch(/more formula warnings are left out\.$/);
    expect(validateAgainst(SCHEMA_IDS.askResult, json).ok).toBe(true);
  });
});
