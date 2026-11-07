// Nested items in the ask's checks (layouts, task 1.3; contract spec: Item IDs at every level,
// Problems inside layouts name the inner item, Layout nesting depth, Draft keys at every level, A
// molecule's item is no layout), over the shipped registry with the layouts given through
// `withWidgetTypes(...LAYOUT_WIDGETS)` while they are not registered (design decision 8), so that
// the same tests pass after they join `WIDGET_TYPES`.

import { describe, expect, test } from "bun:test";
import { innerItemOf, itemExpected, itemKey, placedItems } from "../src/ask-items.ts";
import {
  LAYOUT_WIDGETS,
  lifecycleBoardDocument,
  lifecycleDraftRecord,
  treeBoardDocument,
  withWidgetTypes,
} from "../src/fixtures/index.ts";
import { type DraftRecord, ganttPlanLinkProblems } from "../src/index.ts";
import { validateUpdateRequest } from "../src/update-request.ts";
import {
  draftRecordProblems,
  validateAskRequest,
  validateAskRequestOver,
  validateMoleculeDefinition,
} from "../src/validate.ts";
import { copyOf, probeWbs } from "./molecule-probes.ts";

const TYPES = withWidgetTypes(...LAYOUT_WIDGETS);

type Item = { readonly type: string; readonly id: string; readonly props: unknown };

const field = (id: string): Item => ({ type: "text-field", id, props: { label: id } });
const number = (id: string, props: Record<string, unknown> = {}): Item => ({
  type: "number-field",
  id,
  props: { label: id, ...props },
});
const stack = (id: string, ...items: Item[]): Item => ({ type: "stack", id, props: { items } });
const row = (id: string, ...items: Item[]): Item => ({ type: "row", id, props: { items } });
const group = (id: string, ...items: Item[]): Item => ({
  type: "group",
  id,
  props: { title: id, items },
});
const tabs = (id: string, ...panels: readonly (readonly [string, readonly Item[]])[]): Item => ({
  type: "tabs",
  id,
  props: { tabs: panels.map(([tab, items]) => ({ id: tab, title: tab, items })) },
});
const question = (id: string, ...items: unknown[]) => ({
  type: "question",
  id,
  props: { text: `Question ${id}?`, items },
});
const ask = (...items: unknown[]) => ({ askId: "arrange-ask-a1b2", items });
const askOf = (...items: unknown[]) => ask(question("q", ...items));

const problemsOf = (value: unknown) => {
  const result = validateAskRequestOver(value, TYPES);
  return result.ok ? [] : result.problems;
};
const pathOf = (...segments: (string | number)[]) =>
  `/${segments.map((segment) => String(segment)).join("/")}`;

// Groups nested `count` deep around one field, built from the inside out.
const groups = (count: number): Item => {
  let item: Item = field("leaf");
  for (let at = count; at >= 1; at -= 1) item = group(`g${at}`, item);
  return item;
};

describe("placement of the items of layouts", () => {
  test("places each item of a layout where it is, after the layout, in document order", () => {
    const value = askOf(tabs("t", ["a", [group("g", field("f1"))]], ["b", [field("f2")]]));
    const placed = placedItems(value.items, ["items"]);
    expect(placed.map(({ item }) => item.id)).toEqual(["q", "t", "g", "f1", "f2"]);
    const at = (id: string) => placed.find(({ item }) => item.id === id);
    expect(at("f1")?.at).toEqual([
      "items",
      "0",
      "props",
      "items",
      "0",
      "props",
      "tabs",
      "0",
      "items",
      "0",
      "props",
      "items",
      "0",
    ]);
    expect(at("f1")?.inQuestion).toBe(true);
    expect(at("t")?.depth).toBeLessThan(at("f1")?.depth ?? 0);
  });

  test("leaves a question or an area inside a layout to the schema, as it does in a question", () => {
    const inner = { type: "question", id: "x", props: { text: "Q", options: [{ label: "a" }] } };
    const placed = placedItems(askOf(stack("s", inner as unknown as Item)).items, ["items"]);
    expect(placed.map(({ item }) => item.id)).toEqual(["q", "s"]);
  });
});

describe("item IDs at every level", () => {
  const repeats = (items: readonly unknown[], at: string) =>
    problemsOf(ask(...items)).filter((problem) => problem.path === at);

  test("a nested item with the ID of another question fails at its own path, naming the ID", () => {
    const value = ask(
      question("other", field("z")),
      question("first", group("g", tabs("t", ["a", [field("f")]], ["b", [number("other")]]))),
    );
    const [problem] = problemsOf(value).filter(({ message }) => message.includes('"other"'));
    expect(problem?.path).toBe(
      pathOf(
        "items",
        1,
        "props",
        "items",
        0,
        "props",
        "items",
        0,
        "props",
        "tabs",
        1,
        "items",
        0,
        "id",
      ),
    );
    expect(problem?.itemId).toBe("other");
    expect(problem?.message).toContain("another item of the ask has the ID");
  });

  test("a nested item with the ID of an area, a top-level widget and another nested item fails too", () => {
    const area = {
      type: "area",
      id: "scope",
      props: { title: "Scope", items: [question("in", stack("s", field("scope")))] },
    };
    expect(problemsOf(ask(area)).some(({ message }) => message.includes('"scope"'))).toBe(true);
    const widget = ask(question("one", field("shared"), stack("s", field("shared"))));
    expect(problemsOf(widget).some(({ message }) => message.includes('"shared"'))).toBe(true);
    const twice = askOf(row("r", field("same"), field("b")), stack("s", field("same")));
    expect(problemsOf(twice).some(({ message }) => message.includes('"same"'))).toBe(true);
    expect(repeats([question("q", group("g", field("a"), field("b")))], "x")).toEqual([]);
  });

  test("a nested item with the ID of the layout that holds it fails", () => {
    expect(
      problemsOf(askOf(stack("same", field("same")))).some(({ message }) =>
        message.includes('"same"'),
      ),
    ).toBe(true);
  });

  test("a clean arrangement has no problem", () => {
    const value = askOf(
      tabs(
        "t",
        ["a", [group("g", row("r", field("f1"), number("n")))]],
        ["b", [stack("s", field("f2"))]],
      ),
    );
    expect(problemsOf(value)).toEqual([]);
  });

  test("an ID that starts with u- fails at depth three, naming the prefix", () => {
    const value = askOf(stack("s", group("g", field("u-1"))));
    const [problem] = problemsOf(value);
    expect(problem?.path).toBe(
      pathOf("items", 0, "props", "items", 0, "props", "items", 0, "props", "items", 0, "id"),
    );
    expect(problem?.message).toContain('"u-"');
    expect(problem?.itemId).toBe("u-1");
  });

  test("a u- prefix at the top of a layout fails as in a question", () => {
    expect(problemsOf(askOf(stack("u-stack", field("f"))))[0]?.itemId).toBe("u-stack");
  });
});

describe("problems inside layouts name the inner item", () => {
  const flat = (): ReturnType<typeof problemsOf> =>
    problemsOf(askOf(number("num", { min: 10, max: 5 })));

  test("read as the item's own at the top: same ID, field, expected shape and message", () => {
    const [top] = flat();
    expect(top?.itemId).toBe("num");
    for (const wrapped of [
      stack("s", number("num", { min: 10, max: 5 })),
      group("g", stack("s", number("num", { min: 10, max: 5 }))),
      group("g", row("r", stack("s", group("h", number("num", { min: 10, max: 5 }))), field("x"))),
    ]) {
      const [nested] = problemsOf(askOf(wrapped));
      expect(nested?.itemId).toBe("num");
      expect(nested?.field).toBe(top?.field ?? "");
      expect(nested?.expected).toBe(top?.expected ?? "");
      expect(nested?.message).toBe(top?.message ?? "");
    }
  });

  test("point at the item's path under each layout: depths one, two and four", () => {
    const at = (value: unknown) => problemsOf(askOf(value))[0]?.path;
    const num = () => number("num", { min: 10, max: 5 });
    expect(at(stack("s", num()))).toBe(
      pathOf("items", 0, "props", "items", 0, "props", "items", 0, "props", "max"),
    );
    expect(at(group("g", row("r", field("x"), num())))).toBe(
      pathOf(
        "items",
        0,
        "props",
        "items",
        0,
        "props",
        "items",
        0,
        "props",
        "items",
        1,
        "props",
        "max",
      ),
    );
    expect(at(stack("a", stack("b", stack("c", group("d", num())))))).toBe(
      pathOf(
        ...["items", 0, "props", "items", 0],
        ...["props", "items", 0, "props", "items", 0, "props", "items", 0, "props", "items", 0],
        ...["props", "max"],
      ),
    );
  });

  test("a NumberField in the second tab of a Tabs inside a Group reads at props/tabs/1/items", () => {
    const value = askOf(
      group("g", tabs("t", ["a", [field("f")]], ["b", [number("num", { min: 10, max: 5 })]])),
    );
    const [problem] = problemsOf(value);
    expect(problem?.itemId).toBe("num");
    expect(problem?.field).toBe("props.max");
    expect(problem?.path).toBe(
      pathOf(
        "items",
        0,
        "props",
        "items",
        0,
        "props",
        "items",
        0,
        "props",
        "tabs",
        1,
        "items",
        0,
        "props",
        "max",
      ),
    );
  });

  test("a schema problem in a nested item names it too: a label missing in a TextField", () => {
    const value = askOf(group("g", { type: "text-field", id: "name", props: {} } as Item));
    const [problem] = problemsOf(value);
    expect(problem?.itemId).toBe("name");
    expect(problem?.path).toContain("/props/items/0/props/items/0/props");
  });

  test("an excerpt inside a layout is named at its type, as belonging in the question's own items", () => {
    const excerpt = { type: "excerpt", id: "x", props: { text: "t" } } as Item;
    const problems = problemsOf(askOf(group("g", excerpt)));
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.every(({ path }) => path.includes("/props/items/0/props/items/0"))).toBe(true);
  });

  test("keys by the innermost item's type, and by a layout's own for its own fields", () => {
    const value = question("q", stack("s", group("g", number("num"))));
    const num = [
      "props",
      "items",
      "0",
      "props",
      "items",
      "0",
      "props",
      "items",
      "0",
      "props",
      "max",
    ];
    expect(itemKey(value, num, TYPES)).toBe("number-field.props.max");
    const child = ["props", "items", "0", "props", "items", "1", "type"];
    expect(itemKey(question("q", stack("s", field("a"), field("b"))), child, TYPES)).toBe(
      "stack.props.items[].type",
    );
    const title = ["props", "items", "0", "props", "title"];
    expect(itemKey(question("q", group("g", field("a"))), title, TYPES)).toBe("group.props.title");
    const tab = ["props", "items", "0", "props", "tabs", "1", "title"];
    const arranged = question("q", tabs("t", ["a", [field("a")]], ["b", [field("b")]]));
    expect(itemKey(arranged, tab, TYPES)).toBe("tabs.props.tabs[].title");
  });

  test("finds the item a path is in through each layout, by its list", () => {
    const value = question("q", tabs("t", ["a", [field("f1")]], ["b", [group("g", field("f2"))]]));
    const path = [
      "props",
      "items",
      "0",
      "props",
      "tabs",
      "1",
      "items",
      "0",
      "props",
      "items",
      "0",
      "props",
      "label",
    ];
    const inner = innerItemOf(value, path);
    expect((inner.item as Item).id).toBe("f2");
    expect(inner.rest).toEqual(["props", "label"]);
    const own = innerItemOf(value, ["props", "items", "0", "props", "tabs", "1", "title"]);
    expect((own.item as Item).id).toBe("t");
  });

  test("words a question's items apart from its layouts, and not before the layouts are registered", () => {
    const withLayouts = itemExpected(TYPES)["question.props.items"] ?? "";
    expect(withLayouts).toContain("layouts (a Stack, a Row, a Group, a Tabs layout)");
    expect(withLayouts).not.toContain(
      "widgets (a Tree, a Gantt, an Approval, a Scale, a Ranking, a LaTeX, a Kanban, a Timeline, a Text, a Value, a Divider, a TextField, a NumberField, a MoneyField, a DateField, a Toggle, a Stack",
    );
    expect(itemExpected()["question.props.items"]).not.toContain("layouts (");
  });
});

describe("layout nesting depth", () => {
  test("four layouts deep around a field pass, and five name the fifth, before the schema", () => {
    expect(problemsOf(askOf(groups(4)))).toEqual([]);
    const problems = problemsOf(askOf(groups(5)));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.itemId).toBe("g5");
    expect(problems[0]?.message).toMatch(/nest at most 4 deep/);
    expect(problems[0]?.path).toBe(
      pathOf("items", 0, ...Array.from({ length: 5 }, () => ["props", "items", 0]).flat(), "props"),
    );
  });

  test("counts layouts of every kind, inside an area's question too", () => {
    const deep = stack(
      "a",
      row(
        "b",
        group("c", tabs("d", ["x", [stack("e", field("f"))]], ["y", [field("g")]])),
        field("h"),
      ),
    );
    const area = { type: "area", id: "ar", props: { title: "Area", items: [question("q", deep)] } };
    const problems = problemsOf(ask(area));
    expect(problems).toHaveLength(1);
    expect(problems[0]?.itemId).toBe("e");
  });

  test("100,000 nested Groups through ask are refused with the depth problem, and nothing throws", () => {
    const value = askOf(groups(100_000));
    const result = validateAskRequest(value);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toHaveLength(1);
      expect(result.problems[0]?.message).toContain("nest at most 4 deep");
      expect(result.problems[0]?.itemId).toBe("g5");
    }
  });

  test("100,000 nested Groups in an area's question are refused too", () => {
    const area = {
      type: "area",
      id: "ar",
      props: { title: "Area", items: [question("q", groups(100_000))] },
    };
    const result = validateAskRequest(ask(area));
    expect(result.ok).toBe(false);
  });

  test("the same through an update's add, naming the path under the action", () => {
    const request = {
      askId: "arrange-ask-a1b2",
      actions: [{ action: "add", item: question("n", groups(100_000)) }],
    };
    const result = validateUpdateRequest(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toHaveLength(1);
      expect(result.problems[0]?.path.startsWith("/actions/0/item/props/items/0")).toBe(true);
      expect(result.problems[0]?.message).toContain("nest at most 4 deep");
    }
    const four = {
      askId: "arrange-ask-a1b2",
      actions: [{ action: "add", item: question("n", groups(4)) }],
    };
    expect(validateUpdateRequest(four).ok).toBe(false); // the layouts are unregistered in the shipped schema
  });

  test("a change's props, which are an object whatever they hold, never throw", () => {
    const props = { items: [groups(100_000)] };
    const request = {
      askId: "arrange-ask-a1b2",
      actions: [{ action: "change", itemId: "q", props }],
    };
    expect(() => validateUpdateRequest(request)).not.toThrow();
  });

  test("an item that is no record, or a list that holds none, is no depth problem", () => {
    expect(validateAskRequest({ askId: "arrange-ask-a1b2", items: [null, 3] }).ok).toBe(false);
    expect(validateAskRequest({ askId: "arrange-ask-a1b2", items: "x" }).ok).toBe(false);
  });
});

describe("draft keys at every level", () => {
  const nested = group("grp", row("rw", number("hours"), field("who")));
  const [scope, delivery] = lifecycleBoardDocument.items;
  if (scope?.type !== "area") throw new Error("the fixture's first item is an area");
  const document = {
    ...lifecycleBoardDocument,
    items: [
      {
        ...scope,
        props: {
          ...scope.props,
          items: scope.props.items.map((each) =>
            each.id === "payment" ? { ...each, props: { ...each.props, items: [nested] } } : each,
          ),
        },
      },
      delivery,
    ],
  } as never;
  const record = (values: Record<string, unknown>): DraftRecord =>
    ({
      ...lifecycleDraftRecord,
      questions: { payment: { rev: 1, values } },
    }) as unknown as DraftRecord;
  const refused = (values: Record<string, unknown>) =>
    draftRecordProblems(record(values), document).map(({ path }) => path);

  test("a value for an item inside a Group, inside a Row, is accepted", () => {
    expect(refused({ hours: 3, who: "Ada" })).toEqual([]);
  });

  test("a value keyed by a layout's ID is refused, naming the key", () => {
    for (const key of ["grp", "rw"]) {
      expect(refused({ [key]: 1 })).toEqual([`/questions/payment/values/${key}`]);
    }
  });

  test("an inherited name is an unknown ID", () => {
    const values = JSON.parse('{"constructor":1,"__proto__":2,"toString":3}') as Record<
      string,
      unknown
    >;
    expect(refused(values).sort()).toEqual(
      [
        "/questions/payment/values/__proto__",
        "/questions/payment/values/constructor",
        "/questions/payment/values/toString",
      ].sort(),
    );
  });

  test("results and entries at every level follow the same rule", () => {
    const keyed = (field: "results" | "entries", key: string) =>
      draftRecordProblems(
        {
          ...lifecycleDraftRecord,
          questions: { payment: { rev: 1, [field]: { [key]: "x" } } },
        } as unknown as DraftRecord,
        document,
      ).map(({ path }) => path);
    expect(keyed("results", "hours")).toEqual([]);
    expect(keyed("entries", "who")).toEqual([]);
    expect(keyed("results", "grp")).toEqual(["/questions/payment/results/grp"]);
    expect(keyed("entries", "rw")).toEqual(["/questions/payment/entries/rw"]);
  });
});

describe("a Gantt plan's link at any depth", () => {
  const [QUESTION] = treeBoardDocument.items;
  const [WBS] = QUESTION.props.items;
  const PLAN = {
    type: "gantt",
    id: "schedule",
    props: { start: "2026-12-01", workPackages: "wbs", tasks: {} },
  };
  const holding = (...items: unknown[]) => ({ ...QUESTION, props: { ...QUESTION.props, items } });

  test("a plan in one tab finds a Tree in another, and one in a Group inside a Stack", () => {
    const tabbed = holding(
      tabs("t", ["plan", [PLAN as unknown as Item]], ["tree", [WBS as unknown as Item]]),
    );
    expect(ganttPlanLinkProblems(PLAN, tabbed)).toEqual([]);
    const deeper = holding(stack("s", group("g", WBS as unknown as Item)), PLAN);
    expect(ganttPlanLinkProblems(PLAN, deeper)).toEqual([]);
  });

  test("a plan naming another question's Tree fails as before", () => {
    const [problem] = ganttPlanLinkProblems(
      PLAN,
      holding(tabs("t", ["plan", [PLAN as unknown as Item]], ["other", [field("f")]])),
    );
    expect(problem?.message).toContain("name no item of its question");
    expect(problem?.path).toBe("/workPackages");
  });

  test("a plan naming a layout, or a Tree with no estimates at depth, is refused as at the top", () => {
    const layout = holding(stack("wbs", field("f")), PLAN);
    expect(ganttPlanLinkProblems(PLAN, layout)[0]?.message).toContain("not a Tree");
    const bare = { ...WBS, props: { ...WBS.props, columns: [] } };
    const [problem] = ganttPlanLinkProblems(
      PLAN,
      holding(group("g", bare as unknown as Item), PLAN),
    );
    expect(problem?.message).toContain("optimistic");
  });
});

describe("a Gantt plan's link through the ask's checks (review S-1)", () => {
  const [QUESTION] = treeBoardDocument.items;
  const [WBS] = QUESTION.props.items;
  const PLAN = {
    type: "gantt",
    id: "schedule",
    props: { start: "2026-12-01", workPackages: "wbs", tasks: {} },
  } as unknown as Item;
  const tree = WBS as unknown as Item;
  const linkProblems = (...items: unknown[]) =>
    problemsOf(askOf(...items)).filter(({ message }) => message.includes("plan schedule"));

  test("a plan and its Tree in the same tab pass", () => {
    expect(problemsOf(askOf(tabs("t", ["both", [tree, PLAN]], ["other", [field("f")]])))).toEqual(
      [],
    );
  });

  test("a plan and its Tree in two tabs pass", () => {
    expect(problemsOf(askOf(tabs("t", ["plan", [PLAN]], ["tree", [tree]])))).toEqual([]);
  });

  test("a plan in a Group with its Tree at the top level passes, and a plan and Tree in a Stack too", () => {
    expect(problemsOf(askOf(tree, group("g", PLAN)))).toEqual([]);
    expect(problemsOf(askOf(stack("s", tree, PLAN)))).toEqual([]);
  });

  test("a plan with no Tree in its question still fails, naming the plan, at any depth", () => {
    for (const items of [
      [PLAN],
      [group("g", PLAN)],
      [tabs("t", ["plan", [PLAN]], ["other", [field("f")]])],
      [stack("s", group("g", row("r", PLAN, field("f"))))],
    ]) {
      const [problem] = linkProblems(...items);
      expect(problem?.message).toContain("name no item of its question");
    }
  });

  test("a plan naming a Tree of another question of the ask still fails", () => {
    const result = problemsOf({
      askId: "arrange-ask-a1b2",
      items: [
        question("q1", tree),
        question("q2", tabs("t", ["plan", [PLAN]], ["x", [field("f")]])),
      ],
    }).filter(({ message }) => message.includes("plan schedule"));
    expect(result[0]?.message).toContain("name no item of its question");
  });
});

describe("a molecule's item is no layout", () => {
  test("a definition whose one item is a Group is refused, naming the molecule", () => {
    const definition = copyOf(probeWbs) as unknown as {
      molecule: string;
      items: [{ type: string; props: unknown }];
    };
    definition.items[0].type = "group";
    const result = validateMoleculeDefinition(definition);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const [problem] = result.problems;
      expect(problem?.path).toBe("/items/0/type");
      expect(problem?.message).toContain(`"${definition.molecule}"`);
      expect(problem?.message).toContain("composes one widget");
    }
  });

  test("a definition whose item is a widget still passes", () => {
    expect(validateMoleculeDefinition(copyOf(probeWbs)).ok).toBe(true);
  });
});
