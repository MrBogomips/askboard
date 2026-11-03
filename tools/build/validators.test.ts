import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BOARD_PROTOCOL_MESSAGES,
  BOARD_PROTOCOL_VERSION,
  PUSH_HOST_MESSAGES,
} from "@askboard/contract";
import {
  boardProtocolExamples,
  lifecycleProtocolExamples,
  plainChoiceBoardDocument,
  subagentOrigin,
  uncheckedOrigin,
  waitingAgentStatus,
} from "@askboard/contract/fixtures";
import {
  validateAgentStatus,
  validateBoardMessage,
  validateOrigin,
} from "@askboard/contract/validate";
import { HOST_VALIDATORS_RUNTIME, hostValidatorsCode } from "./validators.ts";

type Check = ((value: unknown) => boolean) & { errors?: unknown[] | null };

const code = hostValidatorsCode();
let dir = "";
let generated: Record<string, Check> = {};

// The generated module needs Ajv's run-time helper by its package name, which resolves from the
// board page's folder in the build; here it is pointed at this folder's resolution instead.
const load = async (source: string, name: string): Promise<Record<string, Check>> => {
  const runtime = Bun.resolveSync(HOST_VALIDATORS_RUNTIME, import.meta.dir);
  const file = join(dir, `${name}.mjs`);
  await Bun.write(file, source.replaceAll(`"${HOST_VALIDATORS_RUNTIME}"`, JSON.stringify(runtime)));
  return (await import(file)).hostMessageSchemas;
};

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "askboard-validators-"));
  generated = await load(code, "validators");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("the board page's standalone validators (AD-7, design decision 7)", () => {
  test("need nothing at run time but Ajv's ucs2length helper", () => {
    const required = [...code.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);
    expect([...new Set(required)]).toEqual([HOST_VALIDATORS_RUNTIME]);
    expect(code).not.toMatch(/\bimport\s*[{*\w]/);
  });

  test("hold no eval and no Function constructor, which the board page's CSP blocks", () => {
    expect(code).not.toMatch(/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/);
  });

  test("export one validator for each message board-host sends, push delivery's included", () => {
    expect(Object.keys(generated).sort()).toEqual(
      Object.keys({ ...BOARD_PROTOCOL_MESSAGES.toPage, ...PUSH_HOST_MESSAGES }).sort(),
    );
  });

  const valid = boardProtocolExamples.toPage as readonly { type: string }[];
  const invalid: readonly { type: string }[] = [
    { version: "1.0", type: "board", document: { ...plainChoiceBoardDocument, extra: 1 } },
    { version: "1.0", type: "state", state: { ask: "waiting", questions: [] } },
    { version: "1.0", type: "receipt", itemId: "database", receipt: "sent" },
    { version: "1.0", type: "discarded", reason: "agent-finished" },
    { version: "1.0", type: "moved", why: "x" },
    { version: "1.0", type: "refused", reason: "token" },
  ] as never;

  test.each([...valid, ...invalid].map((message) => [message.type, message] as const))(
    "agree with the contract's validation on a %s message",
    (type, message) => {
      const check = generated[type];
      if (check === undefined) throw new Error(`no generated validator for ${type}`);
      expect(check(message)).toBe(validateBoardMessage("toPage", message).ok);
    },
  );

  test("each valid example passes and each invalid one fails", () => {
    expect(valid.every((message) => generated[message.type]?.(message))).toBe(true);
    expect(invalid.some((message) => generated[message.type]?.(message))).toBe(false);
  });

  test("accept what board protocol 1.1 adds, as the contract does (ask-lifecycle, task 1.4)", () => {
    const added = lifecycleProtocolExamples.toPage as readonly { type: string }[];
    expect(new Set(added.map((message) => message.type))).toEqual(
      new Set(["board", "state", "done", "draft", "closed", "refused", "discarded"]),
    );
    for (const message of added) {
      const check = generated[message.type];
      expect({ message, ok: check?.(message) }).toEqual({ message, ok: true });
      expect(validateBoardMessage("toPage", message).ok).toBe(true);
    }
  });

  // A board document whose question holds context items (excerpts, design decision 2), each type
  // valid and each refused, so every validator the items add runs.
  const [question] = plainChoiceBoardDocument.items;
  const withItems = (items: readonly unknown[]) => ({
    version: BOARD_PROTOCOL_VERSION,
    type: "board",
    document: {
      ...plainChoiceBoardDocument,
      items: [{ ...question, props: { ...question.props, items } }],
    },
  });
  const contextItems = [
    { type: "excerpt", id: "adr", props: { pointer: "docs/adr/0012.md#Decision" } },
    { type: "excerpt", id: "note", props: { text: "retries: 3", title: "Settings" } },
    { type: "reference", id: "pr", props: { url: "https://github.com/acme/pay/pull/12" } },
    { type: "reference", id: "src", props: { pointer: "src/retry.ts#L1-L5" } },
    { type: "image", id: "shot", props: { pointer: ".askboard/media/shot.png", alt: "Log" } },
  ];
  const context: readonly { type: string }[] = [
    withItems(contextItems),
    ...contextItems.map((item) => withItems([{ ...item, props: { ...item.props, extra: 1 } }])),
    ...contextItems.map((item) => withItems([{ ...item, id: "" }])),
    withItems([{ type: "image", id: "shot", props: { pointer: "" } }]),
    withItems([{ type: "probe", id: "x", props: {} }]),
    withItems([]),
  ];

  test("agree with the contract on board documents holding context items (excerpts, task 1.2)", () => {
    expect(validateBoardMessage("toPage", context[0]).ok).toBe(true);
    for (const message of context) {
      const ok = generated[message.type]?.(message);
      expect({ message, ok }).toEqual({ message, ok: validateBoardMessage("toPage", message).ok });
    }
  });

  test("key each validator by its message name, quoted, so a name need not be an identifier", async () => {
    // A later host message such as `snapshot-saved`, here checked against `moved`'s schema.
    const messages = {
      ...BOARD_PROTOCOL_MESSAGES.toPage,
      "snapshot-saved": BOARD_PROTOCOL_MESSAGES.toPage.moved,
    };
    const extended = await load(hostValidatorsCode(messages), "extended");
    expect(Object.keys(extended)).toEqual(Object.keys(messages));
    const check = extended["snapshot-saved"];
    expect(check?.({ version: BOARD_PROTOCOL_VERSION, type: "moved" })).toBe(true);
    expect(check?.({ version: BOARD_PROTOCOL_VERSION, type: "moved", why: "x" })).toBe(false);
    // The listed messages keep their validators beside it.
    const added = lifecycleProtocolExamples.toPage as readonly { type: string }[];
    for (const message of [...valid, ...invalid, ...added, ...context]) {
      const ok = extended[message.type]?.(message);
      expect({ message, ok }).toEqual({ message, ok: validateBoardMessage("toPage", message).ok });
    }
  });
});

describe("the origin and agent messages' standalone validators (task 8.4)", () => {
  const checks: readonly [string, unknown, (value: unknown) => { ok: boolean }][] = [
    ["a subagent's origin", subagentOrigin, validateOrigin],
    ["an unchecked ask's origin", uncheckedOrigin, validateOrigin],
    ["an origin with a field too many", { ...uncheckedOrigin, cwd: "/" }, validateOrigin],
    [
      "an origin with an ordinal of 1",
      { ...uncheckedOrigin, who: { label: "x", ordinal: 1 } },
      validateOrigin,
    ],
    [
      "an origin with an agent name too long",
      { ...uncheckedOrigin, who: { label: "x", name: "n".repeat(257) } },
      validateOrigin,
    ],
    ["an origin with an empty project", { ...uncheckedOrigin, project: "" }, validateOrigin],
    ["the agent status", waitingAgentStatus, validateAgentStatus],
    [
      "an agent status of another value",
      { ...waitingAgentStatus, status: "idle" },
      validateAgentStatus,
    ],
  ];

  test.each(checks)("agree with the contract's validation on %s", (_, message, validate) => {
    const type = (message as { type: string }).type;
    expect(generated[type]?.(message)).toBe(validate(message).ok);
  });
});
