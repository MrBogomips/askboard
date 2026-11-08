import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { plainChoiceBoardDocument } from "../src/fixtures/board-document.ts";
import {
  type RequestProblem,
  validateAskRequest,
  validateBoardDocument,
  validateUpdateRequest,
} from "../src/validate.ts";

// Widget items in a question (widget-answers, task 1.2; contract spec: Widget items in a question,
// Question props, Widget items in the board document): `tree`, `gantt` and `molecule` beside the
// context items in a question's `items`, `options` optional, "options, items or both".
type Item = { type: string; id: string; props: Record<string, unknown> };

const FIXTURES = join(import.meta.dir, "fixtures");
const read = async (path: string) => (await Bun.file(join(FIXTURES, path)).json()) as unknown;

const TREE: Item = {
  type: "tree",
  id: "wbs",
  props: { nodes: [{ id: "ux", label: "UX design" }] },
};
const GANTT: Item = {
  type: "gantt",
  id: "plan",
  props: { start: "2026-11-02", tasks: [{ id: "ux", label: "UX design", duration: 6 }] },
};
const EXCERPT: Item = { type: "excerpt", id: "note", props: { text: "Context." } };
const REFERENCE: Item = {
  type: "molecule",
  id: "estimate",
  props: { molecule: "wbs-pert", data: {} },
};

const question = (id: string, items?: Item[], options = false): Item => ({
  type: "question",
  id,
  props: {
    text: `Question ${id}?`,
    ...(options ? { options: [{ label: "Yes" }, { label: "No" }] } : {}),
    ...(items === undefined ? {} : { items }),
  },
});
const ask = (...items: Item[]) => ({ askId: "widget-ask-a1b2", items });
const problemsOf = (value: unknown): readonly RequestProblem[] => {
  const checked = validateAskRequest(value);
  return checked.ok ? [] : checked.problems;
};
const passes = (value: unknown) =>
  expect(validateAskRequest(value)).toEqual({ ok: true, value: value as never });

describe("widget items in a question's items", () => {
  test("a Tree and a Gantt with its own tasks pass, with no options", () => {
    passes(ask(question("plan-q", [TREE, GANTT])));
  });

  test("an excerpt beside a Tree passes, both kept in the order sent", () => {
    const checked = validateAskRequest(ask(question("plan-q", [EXCERPT, TREE])));
    expect(checked.ok).toBe(true);
    const props = (checked.ok ? checked.value.items[0]?.props : undefined) as { items?: Item[] };
    expect(props.items?.map(({ id }) => id)).toEqual(["note", "wbs"]);
  });

  test("a molecule reference passes, with its own props", () => {
    passes(ask(question("q", [REFERENCE])));
  });

  test("a Tree beside options passes", () => {
    passes(ask(question("q", [TREE], true)));
  });

  test("the approved UJ-2 ask passes unchanged", async () => {
    expect(validateAskRequest(await read("asks/uj2-wbs-gantt.json")).ok).toBe(true);
  });

  test("the approved UJ-1 ask is refused, naming each undefined item's ID and type", async () => {
    const named = problemsOf(await read("asks/uj1-diff-graph.json")).filter(
      (problem) => problem.field === "type",
    );
    expect(named.map((problem) => problem.itemId)).toEqual(["fix-diff", "retry-states"]);
    for (const { itemId, message } of named) expect(message).toStartWith(`item "${itemId}", type`);
  });

  test("a widget type the input format does not define is refused at its type", () => {
    const table: Item = { type: "spreadsheet", id: "rates", props: { rows: [] } };
    const [problem, ...rest] = problemsOf(ask(question("q", [table], true)));
    expect(rest).toEqual([]);
    expect(problem).toMatchObject({ itemId: "rates", field: "type" });
  });

  test("a Tree whose ID another question holds is refused as used twice", () => {
    const problems = problemsOf(
      ask(question("wbs", undefined, true), question("q", [{ ...TREE, id: "wbs" }])),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ itemId: "wbs", field: "id" });
    expect(problems[0]?.message).toContain("another item of the ask has the ID");
  });

  test("a Tree whose ID one of its own excerpts holds is refused as used twice", () => {
    const problems = problemsOf(ask(question("q", [{ ...EXCERPT, id: "wbs" }, TREE])));
    expect(problems.map(({ itemId }) => itemId)).toEqual(["wbs"]);
    expect(problems[0]?.message).toContain("another item of the ask has the ID");
  });

  test("a widget item's ID with the reserved prefix is refused", () => {
    const problems = problemsOf(ask(question("q", [{ ...TREE, id: "u-1" }])));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('"u-" is reserved');
  });

  test("a widget item's unknown prop is refused, naming the item and the field", () => {
    const problems = problemsOf(ask(question("q", [{ ...TREE, props: { nodes: [], colour: 1 } }])));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ itemId: "wbs" });
    expect(problems[0]?.field).toContain("colour");
  });
});

describe("a question needs options, items or both", () => {
  test("a question with neither is refused, naming its ID", () => {
    const [problem, ...rest] = problemsOf(ask(question("empty")));
    expect(rest).toEqual([]);
    expect(problem).toMatchObject({ itemId: "empty" });
    expect(problem?.message).toContain("options, items or both");
  });

  test("a question with options and no items passes", () => {
    passes(ask(question("q", undefined, true)));
  });

  test("an added question with a Tree and no options passes in an update", () => {
    const value = {
      askId: "widget-ask-a1b2",
      actions: [{ action: "add", item: question("more", [TREE]) }],
    };
    expect(validateUpdateRequest(value).ok).toBe(true);
  });

  test("an added question with neither is refused in an update, at the question's props", () => {
    const value = {
      askId: "widget-ask-a1b2",
      actions: [{ action: "add", item: question("more") }],
    };
    const checked = validateUpdateRequest(value);
    expect(checked.ok).toBe(false);
    const [problem, ...rest] = checked.ok ? [] : checked.problems;
    expect(rest).toEqual([]);
    expect(problem?.path).toBe("/actions/0/item/props");
    expect(problem?.message).toContain("options, items or both");
  });
});

const boardWith = (...items: Item[]) => {
  const [first] = plainChoiceBoardDocument.items;
  return {
    ...plainChoiceBoardDocument,
    items: [{ ...first, props: { ...first.props, items } }],
  };
};

describe("widget items in the board document", () => {
  test("a Tree and a Gantt beside an excerpt pass", () => {
    expect(validateBoardDocument(boardWith(EXCERPT, TREE, GANTT)).ok).toBe(true);
  });

  test("a question with items and no options passes", () => {
    const [first] = plainChoiceBoardDocument.items;
    const { options: _, ...props } = first.props;
    const document = {
      ...plainChoiceBoardDocument,
      items: [{ ...first, props: { ...props, items: [TREE] } }],
    };
    expect(validateBoardDocument(document).ok).toBe(true);
  });

  test("a molecule reference is refused, naming the item and its type", () => {
    const checked = validateBoardDocument(boardWith(REFERENCE));
    expect(checked.ok).toBe(false);
    const problems = checked.ok ? [] : checked.problems;
    expect(problems[0]?.path).toBe("/items/0/props/items/0/type");
    expect(problems[0]?.message).toContain("molecule");
  });
});
