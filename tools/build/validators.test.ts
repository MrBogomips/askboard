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
  contextBoardDocument,
  lifecycleProtocolExamples,
  plainChoiceBoardDocument,
  settingsProtocolExamples,
  snapshotProtocolExamples,
  subagentOrigin,
  uncheckedOrigin,
  waitingAgentStatus,
} from "@askboard/contract/fixtures";
import {
  validateAgentStatus,
  validateBoardMessage,
  validateOrigin,
} from "@askboard/contract/validate";
import { HOST_VALIDATORS_RUNTIMES, hostValidatorsCode } from "./validators.ts";

type Check = ((value: unknown) => boolean) & { errors?: unknown[] | null };

const code = hostValidatorsCode();
let dir = "";
let generated: Record<string, Check> = {};

// The generated module needs Ajv's run-time helper by its package name, which resolves from the
// board page's folder in the build; here it is pointed at this folder's resolution instead.
const load = async (source: string, name: string): Promise<Record<string, Check>> => {
  const file = join(dir, `${name}.mjs`);
  const resolved = HOST_VALIDATORS_RUNTIMES.reduce(
    (text, module) =>
      text.replaceAll(`"${module}"`, JSON.stringify(Bun.resolveSync(module, import.meta.dir))),
    source,
  );
  await Bun.write(file, resolved);
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
  test("need nothing at run time but Ajv's ucs2length and equal helpers", () => {
    const required = [...code.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);
    expect([...new Set(required)].sort()).toEqual([...HOST_VALIDATORS_RUNTIMES].sort());
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

  test("agree with the contract on a state that logs widget values (widget-answers, task 1.4)", () => {
    const answer = { when: "2026-11-02T09:30:00Z", receipt: "sent" as const };
    const tree = { nodes: [{ id: "ux", label: "UX design" }] };
    const state = (extra: Record<string, unknown>) => ({
      version: BOARD_PROTOCOL_VERSION,
      type: "state",
      state: {
        ask: "waiting",
        questions: [{ itemId: "plan", rev: 1, state: "answered", answer: { ...answer, ...extra } }],
      },
    });
    const accepted = state({ values: { wbs__tree: tree } });
    const refused = [
      state({ values: {} }),
      state({ values: { wbs__tree: [] } }),
      state({ values: { wbs__tree: tree }, derived: { "plan.finish": 1 } }),
    ];
    expect(generated.state?.(accepted)).toBe(true);
    expect(validateBoardMessage("toPage", accepted).ok).toBe(true);
    for (const message of refused) {
      expect(generated.state?.(message)).toBe(false);
      expect(validateBoardMessage("toPage", message).ok).toBe(false);
    }
  });

  test("agree with the contract on a state that logs widget results (widget-registry, task 2.2)", () => {
    const answered = (extra: Record<string, unknown>) => ({
      version: BOARD_PROTOCOL_VERSION,
      type: "state",
      state: {
        ask: "waiting",
        questions: [
          {
            itemId: "choose",
            rev: 1,
            state: "answered",
            answer: { when: "2026-11-06T09:30:00Z", receipt: "sent", ...extra },
          },
        ],
      },
    });
    const accepted = [
      answered({ results: { pick: { pick: "a" } } }),
      answered({ results: { pick: [1, null], other: "text" } }),
      answered({ values: { pick: { options: [] } }, results: { pick: 3 } }),
    ];
    const refused = [
      answered({ results: {} }),
      answered({ results: { "a b": 1 } }),
      answered({ results: [1] }),
    ];
    for (const message of accepted) {
      expect(generated.state?.(message)).toBe(true);
      expect(validateBoardMessage("toPage", message).ok).toBe(true);
    }
    for (const message of refused) {
      expect(generated.state?.(message)).toBe(false);
      expect(validateBoardMessage("toPage", message).ok).toBe(false);
    }
  });

  test("agree with the contract on a draft record that holds cell entries (table-widget, task 1.5)", () => {
    const record = (cellEntries: unknown) => ({
      version: BOARD_PROTOCOL_VERSION,
      type: "draft",
      record: { delivery: "immediate", questions: { q: { rev: 1, cellEntries } } },
    });
    const cells = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, at) => [`r${at}.f`, "x"]));
    const accepted = [
      record({ costs: { "pm.rate": "12,5" } }),
      record({ costs: { "pm.rate": "😀".repeat(200) } }),
      record(JSON.parse('{"__proto__":{"__proto__.rate":"x","constructor.toString":"y"}}')),
      record({ costs: cells(2_000) }),
      record({}),
    ];
    const refused = [
      record({ costs: { "pm.rate": "" } }),
      record({ costs: { "pm.rate": "x".repeat(201) } }),
      record({ costs: { "pm.rate": 5 } }),
      record({ costs: { "pm.rate.x": "x" } }),
      record({ costs: { pm: "x" } }),
      record({ "a b": { "pm.rate": "x" } }),
      record({ costs: cells(2_001) }),
      record(["x"]),
    ];
    for (const message of accepted) {
      expect(generated.draft?.(message)).toBe(true);
      expect(validateBoardMessage("toPage", message).ok).toBe(true);
    }
    for (const message of refused) {
      expect(generated.draft?.(message)).toBe(false);
      expect(validateBoardMessage("toPage", message).ok).toBe(false);
    }
  });

  test("agree with the contract on what board protocol 1.2 adds (settings-languages, task 2.6)", () => {
    const check = generated.settings;
    const [every] = settingsProtocolExamples.toPage;
    const keys = every?.keys;
    const invalid = [
      { ...every, keys: { ...keys, theme: { value: "sepia", from: "user", writable: true } } },
      { ...every, keys: { ...keys, editor: { value: "code", from: "user", writable: false } } },
      { ...every, files: { ...every?.files, user: { status: "not-applied" } } },
      { ...every, files: { ...every?.files, user: { status: "absent", problem: { code: "x" } } } },
      { ...every, warnings: [{ code: "unknown-key", file: "user" }] },
      { ...every, write: { key: "editor", outcome: "saved" } },
    ];
    for (const message of settingsProtocolExamples.toPage) expect(check?.(message)).toBe(true);
    for (const message of invalid) {
      const ok = check?.(message);
      expect({ message, ok }).toEqual({ message, ok: validateBoardMessage("toPage", message).ok });
      expect(ok).toBe(false);
    }
  });

  test("agree with the contract on a board document that holds layouts, nested (layouts, task 3.2)", () => {
    const field = (id: string) => ({ type: "text-field", id, props: { label: id } });
    const nest = (item: unknown, id: string) => ({
      type: "group",
      id,
      props: { title: id, items: [item] },
    });
    const row = {
      type: "row",
      id: "r",
      props: { items: [field("a"), field("b")], widths: { a: 2 } },
    };
    const deep = nest(nest(nest(nest(row, "g1"), "g2"), "g3"), "g4");
    const [first] = plainChoiceBoardDocument.items;
    const { options: _, ...props } = first.props;
    const documentOf = (item: unknown) => ({
      ...plainChoiceBoardDocument,
      items: [{ ...first, props: { ...props, items: [item] } }],
    });
    const message = (item: unknown) => ({
      version: BOARD_PROTOCOL_VERSION,
      type: "board",
      document: documentOf(item),
    });
    const accepted = [message(deep), message({ type: "stack", id: "s", props: { items: [row] } })];
    const refused = [
      message(nest({ type: "row", id: "r", props: { items: [field("a")] } }, "g")),
      message(nest({ type: "text-field", id: "t", props: {} }, "g")),
      message(nest({ type: "reference", id: "x", props: { pointer: "a" } }, "g")),
      message(nest({ type: "molecule", id: "m", props: {} }, "g")),
      message({ type: "group", id: "g", props: { title: "g", items: [] } }),
    ];
    for (const each of accepted) {
      expect(generated.board?.(each)).toBe(true);
      expect(validateBoardMessage("toPage", each).ok).toBe(true);
    }
    for (const each of refused) {
      expect(generated.board?.(each)).toBe(false);
      expect(validateBoardMessage("toPage", each).ok).toBe(false);
    }
  });

  // Board documents whose questions hold context items (excerpts, design decision 2): the fixture
  // with every status of every type, and each item broken, so every validator the items add runs.
  const board = (document: unknown) => ({
    version: BOARD_PROTOCOL_VERSION,
    type: "board",
    document,
  });
  const [first, ...others] = contextBoardDocument.items;
  const withItem = (item: unknown) =>
    board({
      ...contextBoardDocument,
      items: [{ ...first, props: { ...first.props, items: [item] } }, ...others],
    });
  const contextItems = contextBoardDocument.items.flatMap((question) => question.props.items ?? []);
  const context: readonly { type: string }[] = [
    board(contextBoardDocument),
    ...contextItems.map((item) => withItem({ ...item, props: { ...item.props, extra: 1 } })),
    ...contextItems.map((item) => withItem({ ...item, id: "" })),
    ...contextItems.map((item) =>
      withItem({ ...item, props: { ...item.props, status: "pending" } }),
    ),
    withItem({ type: "excerpt", id: "adr", props: { pointer: "a.md#A" } }),
    withItem({ type: "probe", id: "x", props: {} }),
    board({ ...contextBoardDocument, items: [{ ...first, props: { ...first.props, items: [] } }] }),
  ];

  test("agree with the contract on board documents holding context items (excerpts, task 1.3)", () => {
    expect(validateBoardMessage("toPage", context[0]).ok).toBe(true);
    for (const message of context) {
      const ok = generated[message.type]?.(message);
      expect({ message, ok }).toEqual({ message, ok: validateBoardMessage("toPage", message).ok });
    }
  });

  test("accept the Snapshot replies board protocol 1.3 adds, and refuse a folder outside write-failed (snapshot, task 1.3)", () => {
    const added = snapshotProtocolExamples.toPage as readonly { type: string }[];
    expect([...new Set(added.map((message) => message.type))]).toEqual([
      "snapshot-saved",
      "snapshot-failed",
    ]);
    const folder = { ...(added.at(-1) as object), folder: "/home/sara/shop/.askboard/snapshots" };
    const relative = { ...(added[0] as object), path: "board.html" };
    for (const message of [...added, folder, relative] as { type: string }[]) {
      const ok = generated[message.type]?.(message);
      expect({ message, ok }).toEqual({ message, ok: validateBoardMessage("toPage", message).ok });
    }
    expect(added.every((message) => generated[message.type]?.(message))).toBe(true);
    expect(generated["snapshot-failed"]?.(folder)).toBe(false);
    expect(generated["snapshot-saved"]?.(relative)).toBe(false);
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
    for (const message of [
      ...valid,
      ...invalid,
      ...added,
      ...context,
      ...settingsProtocolExamples.toPage,
    ]) {
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
