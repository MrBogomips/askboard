// Changes checked against their type (latex-kanban-timeline, task 1.2; contract spec, "Changes
// checked against their type"): `widgetChangesProblems` over a test-made list type, an entry
// without `edits`, a type the registry does not hold, and every approved and fixture Tree, Gantt,
// WBS and Gantt plan answer against the shipped registry.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import * as fixtures from "../src/fixtures/index.ts";
import {
  ganttBoardDocument,
  ganttEditedValue,
  ganttPlanChanges,
  ganttPlanRequestedChanges,
  treeAnswer,
  treeBoardDocument,
  treeEditedValue,
  uj2ExpandedQuestion,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import {
  type Change,
  elementChanges,
  GANTT_SHAPE,
  KANBAN_WIDGET,
  LATEX_WIDGET,
  TIMELINE_WIDGET,
  TREE_SHAPE,
  type WidgetType,
  widgetChangesProblems,
} from "../src/index.ts";
import { elementShapeOf } from "../src/validate.ts";
import { RANKING_WIDGET } from "../src/widgets/ranking/index.ts";

const CHANGES = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:cardlist-changes",
  title: "Card list changes",
  description: "A test-made type's changes: sets of a card's label.",
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["op", "target", "value"],
    properties: {
      op: { const: "set" },
      target: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}\\.[A-Za-z0-9_-]{1,64}\\.label$" },
      value: { type: "string", maxLength: 200 },
    },
  },
} as const;

// A list type that declares sets of a card's label and nothing else.
const LIST: WidgetType = {
  type: "cardlist",
  noun: "a Card list",
  props: { $id: "urn:askboard:input:cardlist-props", type: "object" },
  propsProblems: () => [],
  edits: { changes: CHANGES, shape: () => ({ elements: "cards" }) },
  wording: { expected: {}, fields: {} },
  example: { item: { type: "cardlist", id: "board", props: { cards: [] } } },
};

// A type that edits nothing: no `edits`.
const READ_ONLY: WidgetType = {
  ...LIST,
  type: "readonly",
  noun: "a Read-only",
  props: { $id: "urn:askboard:input:readonly-props", type: "object" },
  edits: undefined,
};

const TYPES: readonly WidgetType[] = [LIST, READ_ONLY];
const board: { readonly type: string; readonly id: string } = { type: "cardlist", id: "board" };

const SET: Change = { op: "set", target: "board.fix-login.label", value: "Fix the login" };
const check = (changes: unknown, item = board, types = TYPES) =>
  widgetChangesProblems(item, changes, types);

describe("an item's changes against its type's changes schema", () => {
  test("changes the type declares pass, and so does a list of none", () => {
    expect(check([SET])).toEqual([]);
    expect(check([])).toEqual([]);
  });

  test("a move fails, naming the item, the operation and the card", () => {
    const [first, ...rest] = check([
      SET,
      { op: "move", target: "board.fix-login", after: "write-docs" },
    ]);
    expect(first).toBeDefined();
    for (const problem of [first, ...rest]) {
      expect(problem?.message).toContain("item board");
      expect(problem?.message).toContain("operation 1");
      expect(problem?.message).toContain("move");
      expect(problem?.message).toContain("board.fix-login");
      expect(problem?.path.startsWith("/1")).toBe(true);
    }
  });

  test("an add, a remove and a set of another field each fail, naming the operation", () => {
    for (const [change, word] of [
      [{ op: "add", target: "board.c1", value: { label: "x" } }, "add"],
      [{ op: "remove", target: "board.c1" }, "remove"],
      [{ op: "set", target: "board.c1.column", value: "done" }, "set"],
      [{ op: "set", target: "board.c1.label", value: null }, "set"],
    ] as const) {
      const [problem] = check([change]);
      expect(problem?.message).toContain("item board");
      expect(problem?.message).toContain(word);
    }
  });

  test("a value that is no list of changes fails, naming the item", () => {
    for (const changes of [{}, "set", 3, null, [null], [3], [{}]]) {
      const [problem] = check(changes);
      expect(problem?.message).toContain("item board");
    }
  });

  test("a long or odd target is shown cut, never whole", () => {
    const target = `board.${"x".repeat(500)}`;
    const [problem] = check([{ op: "move", target }]);
    expect(problem?.message).toContain("item board");
    expect(problem?.message.length).toBeLessThan(400);
    const [other] = check([{ op: "move", target: { deep: [1, 2] } }]);
    expect(other?.message).toContain("operation 0");
  });

  test("the check reads the schema of its own type, whichever types the registry holds", () => {
    const second = { ...LIST, type: "cardlist2", edits: LIST.edits };
    expect(check([SET], { type: "cardlist2", id: "board" }, [LIST, second])).toEqual([]);
    expect(check([SET], { type: "cardlist2", id: "board" }, [])).toEqual([]);
  });
});

describe("a type with no changes schema, or none the registry holds", () => {
  const item = { type: "readonly", id: "note" } as const;

  test("an entry without edits refuses any change, naming the item and the type", () => {
    const [problem, ...rest] = check([SET], item);
    expect(rest).toEqual([]);
    expect(problem?.path).toBe("/");
    expect(problem?.message).toContain("item note");
    expect(problem?.message).toContain("a Read-only");
  });

  test("an entry without edits takes no change, which is none", () => {
    expect(check([], item)).toEqual([]);
  });

  test("the shipped Ranking, which edits nothing, refuses a change and takes none", () => {
    const ranking = { type: "ranking", id: "priorities" };
    expect(check([SET], ranking, [RANKING_WIDGET])).not.toEqual([]);
    expect(check([], ranking, [RANKING_WIDGET])).toEqual([]);
  });

  test("a type the registry does not hold gives no problem, its value having been refused first", () => {
    expect(check([SET], { type: "nosuch", id: "x" })).toEqual([]);
    expect(widgetChangesProblems({ type: "nosuch", id: "x" }, [SET])).toEqual([]);
  });
});

// Every answer of the shipped Tree and Gantt through the shipped registry (decision 6: the check
// runs for every type; a Tree or Gantt edit that failed its own schema would stop the change).
describe("the changes of every approved and fixture Tree and Gantt answer", () => {
  const FIXTURES = join(import.meta.dir, "fixtures");
  const targetsItem = (change: Change) => change.target.split(".")[0] as string;

  // The changes of `events`, by the item each names, checked against the type `types` gives it.
  const checkedByItem = (changes: readonly Change[], types: Record<string, string>) =>
    Object.entries(Object.groupBy(changes, targetsItem)).map(([id, group]) => {
      const type = types[id] as string;
      expect(type).toBeDefined();
      return {
        id,
        type,
        count: group?.length ?? 0,
        problems: widgetChangesProblems({ type, id }, group ?? []),
      };
    });

  test("the approved UJ-2 answer: the WBS Tree and the Gantt plan", async () => {
    const answer = await Bun.file(join(FIXTURES, "answers/uj2-wbs-gantt.json")).json();
    const changes = (answer.asks[0].events as { changes?: Change[] }[]).flatMap(
      (event) => event.changes ?? [],
    );
    const checked = checkedByItem(changes, { wbs: "tree", schedule: "gantt" });
    expect(checked.map(({ id }) => id).sort()).toEqual(["schedule", "wbs"]);
    for (const { problems } of checked) expect(problems).toEqual([]);
  });

  test("the other approved answers hold no change of a widget the registry knows", async () => {
    for (const name of ["plain-choice", "uj1-diff-graph", "uj3-sales-review"]) {
      const answer = await Bun.file(join(FIXTURES, `answers/${name}.json`)).json();
      const events = answer.asks[0].events as { changes?: Change[] }[];
      const changes = events.flatMap((event) => event.changes ?? []);
      // Their items are a graph and a molecule that is no Tree or Gantt: no widget's changes.
      const types = { "retry-states": "graph", estimate: "molecule" };
      for (const { problems } of checkedByItem(changes, types)) expect(problems).toEqual([]);
    }
  });

  test("the fixture Tree answer, and the Tree's whole edit through the generic diff", () => {
    const [question] = treeBoardDocument.items;
    const [wbs] = question.props.items;
    expect(widgetChangesProblems({ type: "tree", id: "wbs" }, treeAnswer.changes ?? [])).toEqual(
      [],
    );
    const diff = elementChanges("wbs", wbs.props, treeEditedValue, TREE_SHAPE);
    expect(diff.length).toBeGreaterThan(0);
    expect(widgetChangesProblems({ type: "tree", id: "wbs" }, diff)).toEqual([]);
  });

  test("a Tree's remove, move and null set pass", () => {
    const sent = {
      columns: [],
      nodes: [
        { id: "a", label: "A", children: [{ id: "a1", label: "A1" }] },
        { id: "b", label: "B", note: "x" },
        { id: "c", label: "C" },
      ],
    };
    const edited = {
      columns: [],
      nodes: [
        { id: "b", label: "B" },
        { id: "a", label: "A", children: [] },
        { id: "d", label: "D" },
      ],
    };
    const changes = elementChanges("wbs", sent, edited, TREE_SHAPE);
    const ops = new Set(changes.map(({ op }) => op));
    expect(ops.has("remove") && ops.has("move") && ops.has("add")).toBe(true);
    expect(changes.some((change) => change.op === "set" && change.value === null)).toBe(true);
    expect(widgetChangesProblems({ type: "tree", id: "wbs" }, changes)).toEqual([]);
  });

  test("the Gantt's own tasks, a plan's request and a plan's link", () => {
    const [question] = ganttBoardDocument.items;
    const [release] = question.props.items;
    const own = elementChanges("release", release.props, ganttEditedValue, GANTT_SHAPE);
    expect(own).not.toEqual([]);
    expect(widgetChangesProblems({ type: "gantt", id: "release" }, own)).toEqual([]);
    for (const changes of [ganttPlanChanges, ganttPlanRequestedChanges]) {
      expect(widgetChangesProblems({ type: "gantt", id: "schedule" }, changes)).toEqual([]);
    }
    const cleared: Change[] = [
      { op: "set", target: "release.ux.start", value: null },
      { op: "set", target: "release.ux.dependencies", value: null },
    ];
    expect(widgetChangesProblems({ type: "gantt", id: "release" }, cleared)).toEqual([]);
  });

  test("a move in a Gantt, a Tree's set of a bad value and a Tree's fieldless set fail", () => {
    const gantt = widgetChangesProblems({ type: "gantt", id: "release" }, [
      { op: "move", target: "release.ux" },
    ]);
    expect(gantt[0]?.message).toContain("item release");
    expect(gantt[0]?.message).toContain("move");
    expect(
      widgetChangesProblems({ type: "tree", id: "wbs" }, [{ op: "set", target: "wbs.a" }]),
    ).not.toEqual([]);
  });
});

// Every answer and edited value the fixtures export, found by walking `src/fixtures/index.ts`
// instead of naming them (task 1.8), so a later fixture is covered.
describe("every answer event and edited value among the fixtures", () => {
  const ALL = withWidgetTypes(LATEX_WIDGET, KANBAN_WIDGET, TIMELINE_WIDGET);
  const exported = Object.entries(fixtures as Record<string, unknown>);

  const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  // Every widget item { type, id, props } in `value`, to its type; an ID with two types throws.
  const collectItems = (value: unknown, into: Map<string, string>, seen = new Set<unknown>()) => {
    if (!isObject(value) || seen.has(value)) return;
    seen.add(value);
    if (
      typeof value.type === "string" &&
      typeof value.id === "string" &&
      isObject(value.props) &&
      ALL.some(({ type }) => type === value.type)
    ) {
      const held = into.get(value.id);
      if (held !== undefined && held !== value.type) {
        throw new Error(`item ${value.id} has two types: ${held} and ${value.type}`);
      }
      into.set(value.id, value.type);
    }
    for (const inner of Object.values(value)) collectItems(inner, into, seen);
  };

  // Every object shaped as an answer event with changes, with the export it sits in.
  const collectAnswers = (value: unknown, seen = new Set<unknown>()): Record<string, unknown>[] => {
    if (!isObject(value) || seen.has(value)) return [];
    seen.add(value);
    const own = value.type === "answer" && Array.isArray(value.changes) ? [value] : [];
    return [...own, ...Object.values(value).flatMap((inner) => collectAnswers(inner, seen))];
  };

  test("the changes of every answer event are checked against the type of the item they name", () => {
    const types = new Map<string, string>();
    for (const [, value] of exported) collectItems(value, types);
    const answers = collectAnswers(Object.fromEntries(exported));
    // Update both counts when a fixture adds an answer event or a change.
    expect(answers.length).toBe(5);
    expect(answers.some((answer) => answer === fixtures.approvalAnswerEvent)).toBe(true);
    let checked = 0;
    for (const answer of answers) {
      const changes = answer.changes as Change[];
      const groups = Object.entries(
        Object.groupBy(changes, (change) => change.target.split(".")[0] as string),
      );
      for (const [id, group] of groups) {
        const type = types.get(id);
        if (type === undefined)
          throw new Error(`a change names item ${id}, which no fixture sends`);
        expect(widgetChangesProblems({ type, id }, group ?? [], ALL)).toEqual([]);
        checked += group?.length ?? 0;
      }
    }
    expect(checked).toBe(13);
  });

  // Each edited-value export, with the sent item (or question) it edits.
  const [treeQuestion] = treeBoardDocument.items;
  const [ganttQuestion] = ganttBoardDocument.items;
  const planQuestion = fixtures.ganttPlanBoardDocument.items[0];
  const PAIRS: Record<string, readonly { type: string; id: string; props: unknown }[]> = {
    treeEditedValue: treeQuestion.props.items.slice(0, 1),
    ganttEditedValue: ganttQuestion.props.items.slice(0, 1),
    ganttPlanEditedValue: planQuestion.props.items.filter(({ id }) => id === "schedule"),
    uj2ExpandedEditedValues: uj2ExpandedQuestion.props.items,
  };
  const ownProps = (name: string): Record<string, unknown> => {
    const value = (fixtures as Record<string, unknown>)[name] as Record<string, unknown>;
    // One item's edited props, or a map from item ID to its edited props.
    return name === "uj2ExpandedEditedValues" ? value : { [PAIRS[name]?.[0]?.id ?? ""]: value };
  };

  test("every edited-value export is paired with its sent item, and its diff passes its type", () => {
    const names = exported
      .map(([name]) => name)
      .filter((name) => /EditedValues?$/.test(name))
      .sort();
    const unpaired = names.filter((name) => PAIRS[name] === undefined);
    expect(unpaired).toEqual([]);
    expect(names).toEqual(Object.keys(PAIRS).sort());
    let checked = 0;
    for (const name of names) {
      const edited = ownProps(name);
      for (const item of PAIRS[name] ?? []) {
        const shape = elementShapeOf(item, ALL);
        expect(shape).toBeDefined();
        if (shape === undefined) continue;
        const changes = elementChanges(
          item.id,
          item.props as object,
          edited[item.id] as object,
          shape,
        );
        expect(widgetChangesProblems(item, changes, ALL)).toEqual([]);
        checked += 1;
      }
    }
    expect(checked).toBe(5);
  });
});
