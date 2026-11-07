import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnswerEvent, LifecycleAskInput } from "@askboard/contract";
import {
  FORM_QUESTION,
  FORM_RESULTS,
  FORM_TYPES,
  LAYOUT_WIDGETS,
  withWidgetTypes,
} from "@askboard/contract/fixtures";
import { EventLog } from "../src/lifecycle/log.ts";
import { BoardModel } from "../src/lifecycle/model.ts";
import { questionStatus } from "../src/lifecycle/states.ts";
import { applyActions, type UpdateContext } from "../src/lifecycle/updates.ts";
import { widgetItemValue } from "../src/lifecycle/widget-fetch.ts";
import { appendedOf, command, created, logOf, WHEN } from "./lifecycle-fakes.ts";
import { answerAct, checked, type Item, type Json, modelOf } from "./probe-fakes.ts";

// Core spec: Field checks on answers, The pattern stays on the board, Answers of PickFields
// (form-widget, design decisions 2 and 3). The shipped `AskCore` holds the shipped registry, so the
// PickField's cases run over `withWidgetTypes(...FORM_TYPES, ...LAYOUT_WIDGETS)` through the units
// that take a registry; the cases that need only the TextField run through `AskCore` itself.

const TYPES = withWidgetTypes(...FORM_TYPES, ...LAYOUT_WIDGETS);
const copy = <T>(value: T): T => structuredClone(value);
const formItems = (): Item[] => copy(FORM_QUESTION.props.items) as unknown as Item[];
const results = (change: Json = {}): Json => ({ ...copy(FORM_RESULTS), ...change });
const without = (id: string): Json => {
  const { [id]: _left, ...rest } = results();
  return rest;
};

const run = (fields: Json, items: Item[] = formItems(), log = new EventLog()) =>
  checked(modelOf(items), [answerAct(fields)], { types: TYPES, log });

// A refusal: its problem, with nothing appended and nothing kept or to publish.
const refusal = (fields: Json, items?: Item[]) => {
  const { log, outcome } = run(fields, items);
  if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
  expect(log.latestSeq).toBe(0);
  expect(Object.keys(outcome).sort()).toEqual(["index", "ok", "problem"]);
  expect(outcome.problem.refusal).toBe("content");
  return outcome.problem;
};

const field = (id: string, type: string, props: Json): Item => ({ type, id, props }) as Item;

describe("a required field left empty", () => {
  test("a required TextField two layouts deep with no result refuses the answer, naming item and check", () => {
    const problem = refusal({ results: without("form-name") });
    expect(problem.detail).toContain("form-name");
    expect(problem.detail).toContain("required");
  });

  test("each other required field, in either tab, is refused the same way", () => {
    for (const id of ["form-start", "form-seats", "form-region"]) {
      const problem = refusal({ results: without(id) });
      expect(problem.detail).toContain(id);
      expect(problem.detail).toContain("required");
    }
  });

  test("a full answer is taken, with every result under its item ID", () => {
    const { log, outcome } = run({ results: results() });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect((outcome.events[0] as AnswerEvent).results).toEqual(results());
    expect([...outcome.kept.values()][0]?.results).toEqual(results());
    expect(log.latestSeq).toBe(0);
  });

  test("false and 0 satisfy required", () => {
    const items = [
      field("flag", "toggle", { label: "Flag", required: true }),
      field("count", "number-field", { label: "Count", required: true }),
    ];
    const { outcome } = run({ results: { flag: false, count: 0 } }, items);
    expect(outcome.ok).toBe(true);
  });

  test("an answer holding only the question's chosen option is refused while a required field is empty", () => {
    const model = BoardModel.of([
      {
        type: "question",
        id: "choose",
        props: {
          text: "Which one, and who are you?",
          options: [{ label: "main" }, { label: "release" }],
          items: [field("who", "text-field", { label: "Who", required: true })],
        },
      },
    ] as unknown as LifecycleAskInput["items"]);
    const log = new EventLog();
    const { outcome } = checked(model, [answerAct({ choice: ["main"] })], { types: TYPES, log });
    if (outcome.ok) throw new Error(`accepted: ${JSON.stringify(outcome.events)}`);
    expect(outcome.problem.detail).toContain("who");
    expect(outcome.problem.detail).toContain("required");
    expect(log.latestSeq).toBe(0);
    expect(Object.keys(outcome)).not.toContain("kept");
  });

  test("a question with no required field is answered by its choice alone, as before", () => {
    const model = BoardModel.of([
      {
        type: "question",
        id: "choose",
        props: {
          text: "Which one?",
          options: [{ label: "main" }, { label: "release" }],
          items: [field("who", "text-field", { label: "Who" })],
        },
      },
    ] as unknown as LifecycleAskInput["items"]);
    const { outcome } = checked(model, [answerAct({ choice: ["main"] })], { types: TYPES });
    expect(outcome.ok).toBe(true);
  });

  test("a refused act beside an accepted one in one command keeps neither", () => {
    const model = modelOf(formItems());
    const log = new EventLog();
    const acts = [answerAct({ results: results() }), answerAct({ results: without("form-name") })];
    const { outcome } = checked(model, acts, { types: TYPES, log });
    expect(outcome.ok).toBe(false);
    expect(log.latestSeq).toBe(0);
  });
});

describe("a decline and a note", () => {
  test("a decline of a question with a required field is taken", () => {
    const { outcome } = checked(
      modelOf(formItems()),
      [{ type: "decline", itemId: "choose", rev: 1, when: WHEN }],
      { types: TYPES },
    );
    expect(outcome.ok).toBe(true);
  });

  test("a note alone is taken as feedback", () => {
    const { outcome } = checked(
      modelOf(formItems()),
      [{ type: "note", itemId: "choose", rev: 1, when: WHEN, note: "Not sure yet." }],
      { types: TYPES },
    );
    expect(outcome.ok).toBe(true);
  });

  test("a decline carrying a result is still refused as a decline", () => {
    const { outcome } = checked(
      modelOf(formItems()),
      [{ type: "decline", itemId: "choose", rev: 1, when: WHEN, results: results() }],
      { types: TYPES },
    );
    expect(outcome.ok).toBe(false);
  });
});

describe("a PickField's checks", () => {
  const picks = (): Item[] => [
    field("channels", "pick-field", {
      label: "Channels",
      multiple: true,
      minItems: 2,
      maxItems: 2,
      options: [
        { id: "email", label: "Email" },
        { id: "chat", label: "Chat" },
        { id: "phone", label: "Phone" },
      ],
    }),
  ];

  test("too many picks are refused naming the item and maxItems", () => {
    const problem = refusal({ results: { channels: ["email", "chat", "phone"] } }, picks());
    expect(problem.detail).toContain("channels");
    expect(problem.detail).toContain("maxItems");
  });

  test("too few picks are refused naming the item and minItems", () => {
    const problem = refusal({ results: { channels: ["email"] } }, picks());
    expect(problem.detail).toContain("channels");
    expect(problem.detail).toContain("minItems");
  });

  test("picks within the counts are taken", () => {
    const { outcome } = run({ results: { channels: ["email", "chat"] } }, picks());
    expect(outcome.ok).toBe(true);
  });

  test("an empty multiple PickField that is required is refused, naming required", () => {
    const items = [
      field("channels", "pick-field", {
        label: "Channels",
        multiple: true,
        required: true,
        options: [
          { id: "email", label: "Email" },
          { id: "chat", label: "Chat" },
        ],
      }),
      field("city", "text-field", { label: "City" }),
    ];
    const problem = refusal({ results: { city: "Turin" } }, items);
    expect(problem.detail).toContain("required");
  });
});

describe("each failure code is refused, naming the item, with nothing appended or kept", () => {
  const cases: [string, Item[], Json, string][] = [
    [
      "required",
      [
        field("name", "text-field", { label: "Name", required: true }),
        field("city", "text-field", { label: "City" }),
      ],
      { results: { city: "Turin" } },
      "required",
    ],
    [
      "minLength",
      [field("name", "text-field", { label: "Name", minLength: 3 })],
      { results: { name: "ab" } },
      "minLength",
    ],
    [
      "minItems",
      [
        field("p", "pick-field", {
          label: "P",
          multiple: true,
          minItems: 2,
          options: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
        }),
      ],
      { results: { p: ["a"] } },
      "minItems",
    ],
    [
      "maxItems",
      [
        field("p", "pick-field", {
          label: "P",
          multiple: true,
          maxItems: 1,
          options: [
            { id: "a", label: "A" },
            { id: "b", label: "B" },
          ],
        }),
      ],
      { results: { p: ["a", "b"] } },
      "maxItems",
    ],
  ];

  test.each(cases)("%s", (_code, items, fields, word) => {
    const problem = refusal(fields, items);
    expect(problem.detail).toContain(items[0]?.id as string);
    expect(problem.detail).toContain(word);
  });

  test("minLength counts code points, so two astral characters meet a minimum of 2", () => {
    const items = [field("name", "text-field", { label: "Name", minLength: 2 })];
    expect(run({ results: { name: "\u{1F600}\u{1F600}" } }, items).outcome.ok).toBe(true);
    refusal({ results: { name: "\u{1F600}" } }, items);
  });
});

describe("the pattern stays on the board", () => {
  test("a text the pattern does not match is taken as the item's result", () => {
    const { outcome } = run({ results: results({ "form-ticket": "ab-1234" }) });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    expect((outcome.events[0] as AnswerEvent).results?.["form-ticket"]).toBe("ab-1234");
  });

  test("core's sources call no pattern check, read no pattern prop and build no RegExp from items", () => {
    const root = join(import.meta.dir, "../src");
    const files = (readdirSync(root, { recursive: true }) as string[]).filter((name) =>
      name.endsWith(".ts"),
    );
    expect(files.length).toBeGreaterThan(10);
    for (const name of files) {
      const source = readFileSync(join(root, name), "utf8");
      expect(source, name).not.toContain("textFieldPatternFailure");
      expect(source, name).not.toMatch(/\.pattern\b|\[\s*["']pattern["']\s*\]|["']pattern["']/);
      // Each RegExp core builds comes from a contract constant or its own ID list, not from an item.
      for (const call of source.match(/new\s+RegExp\s*\([^;]*;/g) ?? []) {
        expect(call, name).not.toMatch(/props|item|result|\.pattern/i);
      }
    }
  });
});

describe("a revision is refused the same way", () => {
  const ask = {
    askId: "intake-form-k3m9",
    items: [
      {
        type: "question",
        id: "intake",
        props: {
          text: "Who are you?",
          items: [
            { type: "text-field", id: "who", props: { label: "Who", required: true } },
            { type: "text-field", id: "city", props: { label: "City" } },
          ],
        },
      },
    ],
  } as unknown as LifecycleAskInput;

  const answerWith = (resultsOf: Json) =>
    command([
      { type: "answer", itemId: "intake", rev: 1, when: WHEN, results: resultsOf } as never,
    ]);

  test("a revision that empties the required field is refused, the earlier answer standing", async () => {
    const { core } = await created(ask);
    expect(core.act(ask.askId, answerWith({ who: "Ada" })).ok).toBe(true);
    const first = logOf(core, ask.askId);
    expect(first).toHaveLength(1);
    const outcome = core.act(ask.askId, answerWith({ city: "Turin" }));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.detail).toContain("who");
      expect(outcome.detail).toContain("required");
    }
    expect(logOf(core, ask.askId)).toEqual(first);
    expect(core.fullValue(ask.askId, "who")).toMatchObject({
      kind: "item",
      item: { result: "Ada" },
    });
  });

  test("a refused first answer appends and publishes nothing, and fetch holds no result", async () => {
    const { core, heard } = await created(ask);
    const outcome = core.act(ask.askId, answerWith({ city: "Turin" }));
    expect(outcome.ok).toBe(false);
    expect(logOf(core, ask.askId)).toEqual([]);
    expect(appendedOf(heard)).toEqual([]);
    expect(heard).toEqual([]);
    const fetched = core.fullValue(ask.askId, "city");
    expect(fetched).toMatchObject({ kind: "item" });
    expect(JSON.stringify(fetched)).not.toContain("Turin");
  });

  test("a text that fails its pattern is taken through AskCore and returned", async () => {
    const patterned = copy(ask) as unknown as { items: { props: { items: Item[] } }[] };
    patterned.items[0]?.props.items.push(
      field("ticket", "text-field", { label: "Ticket", pattern: "^[A-Z]{2}-\\d{4}$" }),
    );
    const { core } = await created(patterned as unknown as LifecycleAskInput);
    const outcome = core.act(ask.askId, answerWith({ who: "Ada", ticket: "ab-1234" }));
    expect(outcome.ok).toBe(true);
    const [event] = logOf(core, ask.askId) as AnswerEvent[];
    expect(event?.results).toEqual({ who: "Ada", ticket: "ab-1234" });
    expect(core.fullValue(ask.askId, "ticket")).toMatchObject({
      kind: "item",
      item: { result: "ab-1234" },
    });
  });
});

describe("a PickField's result is kept and fetched", () => {
  test("the result is logged under the item ID and widgetItemValue returns it", () => {
    const model = modelOf(formItems());
    const log = new EventLog();
    const { outcome } = checked(model, [answerAct({ results: results() })], { types: TYPES, log });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.problem));
    const [event] = outcome.events as AnswerEvent[];
    expect(event?.results?.["form-region"]).toBe("eu");
    expect(event?.results?.["form-channels"]).toEqual(["email", "chat"]);
    model.noteEntries(log.append(outcome.events));
    const question = model.questions()[0];
    if (question === undefined) throw new Error("no question");
    const status = () => questionStatus(question.mark, log.ofItem(question.id));
    const fetch = { map: new Map(), source: undefined, kept: outcome.kept };
    const fetched = widgetItemValue(model, "form-region", status, fetch, TYPES);
    expect(fetched?.item).toMatchObject({ type: "pick-field", id: "form-region", result: "eu" });
  });
});

// The agent's `update` of a field's props is checked as an ask's are, by core's item problems,
// which name the item (the contract's `add` names the request path instead).
describe("an update that would leave a field the board cannot hold (review S-1)", () => {
  const ticket = (props: Json) => field("ticket", "text-field", { label: "Ticket", ...props });

  const setup = (item: Item) => {
    const model = BoardModel.of([
      { type: "question", id: "intake", props: { text: "Ticket?", items: [item] } },
    ] as unknown as LifecycleAskInput["items"]);
    const context: UpdateContext = {
      askId: "ask",
      epoch: "e1",
      who: "Sara Conti",
      now: "2026-11-08T10:00:00Z",
      model,
      log: new EventLog(),
      widgets: { source: undefined, expansion: new Map(), references: new Map() },
      types: TYPES,
    };
    return { model, context };
  };

  const change = (props: Json) => ({ action: "change", itemId: "ticket", props }) as never;

  const refused = (item: Item, props: Json, word: string) => {
    const { model, context } = setup(item);
    const before = JSON.stringify(model.items());
    const result = applyActions(context, [change(props)]);
    if (result.ok) throw new Error(`applied: ${JSON.stringify(result.applied)}`);
    expect(result.refusal).toBe("props");
    expect(result.itemId).toBe("ticket");
    expect(result.detail).toContain(word);
    expect(result.detail).toContain("ticket");
    expect(JSON.stringify(model.items())).toBe(before);
    expect(model.question("intake")?.rev).toBe(1);
  };

  test("a pattern merged onto a field holding maxLength 5000 is refused at the pattern", () => {
    refused(ticket({ maxLength: 5000 }), { pattern: "^[A-Z]+$" }, "pattern");
  });

  test("maxLength 5000 merged onto a patterned field is refused", () => {
    refused(ticket({ pattern: "^[A-Z]+$" }), { maxLength: 5000 }, "maxLength");
  });

  test("a pattern outside the safe subset is refused at the pattern", () => {
    refused(ticket({}), { pattern: "^(a+)+$" }, "pattern");
  });

  test("a pattern within the subset merges, at the next revision", () => {
    const { model, context } = setup(ticket({}));
    const result = applyActions(context, [change({ pattern: "^[A-Z]+$" })]);
    expect(result.ok).toBe(true);
    expect(model.question("intake")?.rev).toBe(2);
  });
});

describe("the same refusals through AskCore", () => {
  const ask = {
    askId: "ticket-form-p7d2",
    items: [
      {
        type: "question",
        id: "intake",
        props: {
          text: "Ticket?",
          items: [
            { type: "text-field", id: "ticket", props: { label: "Ticket", maxLength: 5000 } },
          ],
        },
      },
    ],
  } as unknown as LifecycleAskInput;

  test("an update change merging a pattern onto maxLength 5000 is refused, naming the item", async () => {
    const { core, heard } = await created(ask);
    const outcome = await core.update({
      askId: ask.askId,
      actions: [{ action: "change", itemId: "ticket", props: { pattern: "^[A-Z]+$" } }],
    });
    expect(outcome).toMatchObject({ kind: "refused", refusal: "props", itemId: "ticket" });
    expect(outcome.kind === "refused" && outcome.detail).toContain("ticket");
    expect(heard).toEqual([]);
    expect(logOf(core, ask.askId)).toEqual([]);
  });

  test("and the reverse, maxLength 5000 merged onto a patterned field", async () => {
    const patterned = copy(ask) as unknown as { items: { props: { items: Item[] } }[] };
    patterned.items[0]!.props.items = [
      field("ticket", "text-field", { label: "Ticket", pattern: "^[A-Z]+$" }),
    ];
    const { core, heard } = await created(patterned as unknown as LifecycleAskInput);
    const outcome = await core.update({
      askId: ask.askId,
      actions: [{ action: "change", itemId: "ticket", props: { maxLength: 5000 } }],
    });
    expect(outcome).toMatchObject({ kind: "refused", refusal: "props", itemId: "ticket" });
    expect(heard).toEqual([]);
  });

  test("a change that sets pattern ^(a+)+$ is refused, naming the item", async () => {
    const { core, heard } = await created(ask);
    const outcome = await core.update({
      askId: ask.askId,
      actions: [{ action: "change", itemId: "ticket", props: { pattern: "^(a+)+$" } }],
    });
    expect(outcome).toMatchObject({ kind: "refused", refusal: "props", itemId: "ticket" });
    expect(heard).toEqual([]);
  });
});
