import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ID_PATTERN } from "@askboard/contract";
import { treeBoardDocument, uj2ExpandedQuestion } from "@askboard/contract/fixtures";
import {
  type Expansion,
  type ExpansionMap,
  expandMolecules,
  expansionEntries,
} from "../src/index.ts";
import {
  copyOf,
  deepFreeze,
  fakeMoleculeSource,
  ganttPlan,
  probeSchedule,
  scheduleData,
  uj2Ask,
  wbsData,
  wbsPert,
} from "./molecules.ts";

// Expanding molecule references (molecules design decision 4; core spec, "Expanding molecule
// references", "Molecule versions", "Refusing an expansion", "Expanded IDs", "The expansion map"),
// with a fake `MoleculeSource` over the shipped `wbs-pert` and the test-only `probe-schedule`, and
// over the two shipped definitions for the UJ-2 ask, step 4's widget item checks and E3's areas.

type Json = Record<string, unknown>;
type Item = Json & { readonly type: string; readonly id: string; readonly props: Json };

const { source } = fakeMoleculeSource([wbsPert, probeSchedule]);

const reference = (id: string, molecule: string, data: Json, version?: string): Item => ({
  type: "molecule",
  id,
  props: version === undefined ? { molecule, data } : { molecule, version, data },
});
const question = (id: string, items: readonly unknown[]): Item => ({
  type: "question",
  id,
  props: { text: "Does this plan fit?", header: "Plan", items },
});

const [plan, erpExport] = uj2Ask.items;
/** The UJ-2 ask's items with only the `wbs` reference in the question `plan`. */
const wbsOnly = deepFreeze([
  { ...plan, props: { ...plan?.props, items: plan?.props.items?.slice(0, 1) } },
  erpExport,
]);
const wbs = () => reference("wbs", "wbs-pert", copyOf(wbsData));
const schedule = (data: Json = copyOf(scheduleData)) =>
  reference("schedule", "probe-schedule", data);

/** The Tree the `wbs` reference gives: the contract's UJ-2 Tree, with `pert` and depth 2. */
const [treeQuestion] = treeBoardDocument.items;
const expectedTree = {
  type: "tree",
  id: "wbs__tree",
  props: { ...treeQuestion.props.items[0].props, pert: true, openDepth: 2 },
};

const expanded = (result: Expansion) => {
  if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
  return result;
};
const itemsOf = (result: Expansion, at: number): readonly Item[] =>
  (expanded(result).items[at] as Item).props.items as readonly Item[];
const problemsOf = (result: Expansion) => (result.ok ? [] : result.problems);

describe("expanding the UJ-2 work breakdown", () => {
  test("replaces the reference in place by the Tree wbs__tree, and leaves erp-export as sent", () => {
    const result = expanded(expandMolecules(wbsOnly, source));
    expect(result.items).toHaveLength(2);
    const [question, other] = result.items as readonly Item[];
    expect(question?.props.items).toEqual([expectedTree]);
    expect({ ...question, props: { ...question?.props, items: [] } }).toEqual({
      ...plan,
      props: { ...plan?.props, items: [] },
    });
    expect(other).toBe(erpExport);
  });

  test("the map gives wbs__tree as wbs, wbs-pert 1.0.0, and the board holds no molecule item", () => {
    const result = expanded(expandMolecules(wbsOnly, source));
    expect([...result.map]).toEqual([
      ["wbs__tree", { reference: "wbs", molecule: "wbs-pert", version: "1.0.0" }],
    ]);
    expect(JSON.stringify(result.items)).not.toContain('"molecule"');
  });

  test("leaves its inputs untouched", () => {
    const before = JSON.stringify(wbsOnly);
    expandMolecules(wbsOnly, source);
    expect(JSON.stringify(wbsOnly)).toBe(before);
    expect(Object.isFrozen(wbsOnly[0])).toBe(true);
  });
});

describe("two references in one question", () => {
  const expectedPlan = {
    type: "gantt",
    id: "schedule__plan",
    props: {
      tasks: {
        prototype: { dependencies: ["ux"] },
        portal: { dependencies: ["architecture", "prototype"] },
        billing: { dependencies: ["architecture"] },
        reporting: { dependencies: ["portal"] },
      },
      workPackages: "wbs__tree",
      start: "2026-11-02",
    },
  };

  test("an item fill naming the other reference names its expanded item, in either order", () => {
    const before = expandMolecules([question("plan", [wbs(), schedule()])], source);
    expect(itemsOf(before, 0)).toEqual([expectedTree, expectedPlan]);
    const after = expandMolecules([question("plan", [schedule(), wbs()])], source);
    expect(itemsOf(after, 0)).toEqual([expectedPlan, expectedTree]);
  });

  test("the map lists both, in the order of the references in the ask", () => {
    const result = expanded(expandMolecules([question("plan", [schedule(), wbs()])], source));
    expect([...result.map]).toEqual([
      ["schedule__plan", { reference: "schedule", molecule: "probe-schedule", version: "1.2.0" }],
      ["wbs__tree", { reference: "wbs", molecule: "wbs-pert", version: "1.0.0" }],
    ]);
  });

  test("an item fill naming a plain item of the ask keeps its ID", () => {
    const columns = wbsPert.items[0].props.columns;
    const plainTree = { type: "tree", id: "wbs", props: { columns, nodes: [] } };
    const items = itemsOf(expandMolecules([question("plan", [plainTree, schedule()])], source), 0);
    expect(items[0]).toBe(plainTree);
    expect(items[1]?.props.workPackages).toBe("wbs");
  });

  test("the expanded items share nothing with each other's data or the definitions", () => {
    const data = copyOf(scheduleData);
    const [, plan] = itemsOf(
      expandMolecules([question("plan", [wbs(), schedule(data)])], source),
      0,
    );
    const tasks = plan?.props.tasks as Json;
    expect((tasks.prototype as Json).dependencies).not.toBe((data.dependencies as Json).prototype);
    expect(plan?.props.tasks).not.toBe(probeSchedule.items[0].props.tasks);
  });

  test("the expanded Tree shares nothing with its definition's composition", () => {
    const [tree] = itemsOf(expandMolecules([question("plan", [wbs()])], source), 0);
    const columns = tree?.props.columns as readonly Json[];
    const composed = wbsPert.items[0].props.columns as readonly Json[];
    expect(columns).toEqual(composed);
    expect(columns).not.toBe(composed);
    expect(columns[0]).not.toBe(composed[0]);
  });
});

describe("a question with no reference", () => {
  test("the plain-choice ask's items come back unchanged, with an empty map", async () => {
    const path = join(import.meta.dir, "../../contract/test/fixtures/asks/plain-choice.json");
    const ask = (await Bun.file(path).json()) as { items: readonly unknown[] };
    const result = expanded(expandMolecules(ask.items, source));
    expect(result.items).toEqual(ask.items);
    expect(result.map.size).toBe(0);
  });

  test("a molecule item outside a question's items is not expanded", () => {
    const loose = reference("wbs", "wbs-pert", copyOf(wbsData));
    const result = expanded(expandMolecules([loose], source));
    expect(result.items).toEqual([loose]);
    expect(result.map.size).toBe(0);
  });
});

describe("versions", () => {
  test("a reference with no version, or with 1.0.0, expands with wbs-pert 1.0.0", () => {
    for (const version of [undefined, "1.0.0"]) {
      const items = [question("plan", [reference("wbs", "wbs-pert", copyOf(wbsData), version)])];
      const result = expanded(expandMolecules(items, source));
      expect(result.map.get("wbs__tree")?.version).toBe("1.0.0");
    }
  });

  test("the map records the version the reference expanded with, not the one it asked for", () => {
    const asked = reference("schedule", "probe-schedule", copyOf(scheduleData), "1.1.0");
    const columns = wbsPert.items[0].props.columns;
    const plainTree = { type: "tree", id: "wbs", props: { columns, nodes: [] } };
    const result = expanded(expandMolecules([question("plan", [plainTree, asked])], source));
    expect(result.map.get("schedule__plan")?.version).toBe("1.2.0");
  });

  test("a version not shipped is refused, naming the reference and wbs-pert 1.0.0", () => {
    const items = [question("plan", [reference("wbs", "wbs-pert", copyOf(wbsData), "2.0.0")])];
    expect(expandMolecules(items, source)).toEqual({
      ok: false,
      problems: [
        {
          itemId: "wbs",
          path: "/0/props/items/0/props/version",
          message:
            'the molecule reference "wbs" asks for wbs-pert 2.0.0, which AskBoard does not ship: it ships wbs-pert 1.0.0',
        },
      ],
    });
  });

  test("an unknown molecule is refused, naming the reference and the shipped molecules", () => {
    const items = [question("plan", [reference("review", "sales-estimate-review", {})])];
    expect(problemsOf(expandMolecules(items, source))).toEqual([
      {
        itemId: "review",
        path: "/0/props/items/0/props/molecule",
        message:
          'the molecule reference "review" names the molecule "sales-estimate-review", which AskBoard does not ship: it ships probe-schedule and wbs-pert',
      },
    ]);
  });

  test("a broken definition is refused, naming the reference and the source's detail", () => {
    const broken = fakeMoleculeSource([wbsPert], { "wbs-pert": "/fills/calendar: undeclared" });
    const items = [question("plan", [wbs()])];
    expect(problemsOf(expandMolecules(items, broken.source))).toEqual([
      {
        itemId: "wbs",
        path: "/0/props/items/0/props/molecule",
        message:
          'the molecule reference "wbs" names wbs-pert, whose shipped definition AskBoard cannot use: /fills/calendar: undeclared',
      },
    ]);
  });

  test("each reference is looked up once, in the order of the ask, whatever its data", () => {
    const counted = fakeMoleculeSource([wbsPert, probeSchedule]);
    const items = [
      question("plan", [schedule(), reference("wbs", "wbs-pert", { nodes: "none" }, "1.0.0")]),
    ];
    expect(expandMolecules(items, counted.source).ok).toBe(false);
    expect(counted.lookups).toEqual(["probe-schedule", "wbs-pert 1.0.0"]);
  });
});

describe("data problems name the field", () => {
  test("a bad date names the reference and data.start", () => {
    const data = { ...copyOf(scheduleData), start: "11/02/2026" };
    const items = [
      question("plan", [
        reference("wbs", "wbs-pert", copyOf(wbsData)),
        reference("schedule", "gantt-plan", data),
      ]),
    ];
    const result = expandMolecules(items, fakeMoleculeSource([wbsPert, ganttPlan]).source);
    const messages = result.ok ? [] : result.problems.map(({ message }) => message);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('"schedule"');
    expect(messages[0]).toContain("data.start");
  });
});

describe("refusing an expansion", () => {
  test("data outside the parameters is refused, naming the reference and the key", () => {
    const data = { ...copyOf(wbsData), calendar: "work-week" };
    const items = [question("plan", [reference("wbs", "wbs-pert", data)])];
    expect(expandMolecules(items, source)).toEqual({
      ok: false,
      problems: [
        {
          itemId: "wbs",
          path: "/0/props/items/0/props/data/calendar",
          message:
            'the data of the molecule reference "wbs" (wbs-pert 1.0.0): unknown field "calendar"',
        },
      ],
    });
  });

  test("a problem deep in the data names its path under the reference", () => {
    const data = copyOf(wbsData) as { nodes: Json[] };
    const [design] = data.nodes as { children: Json[] }[];
    (design?.children[0] as Json).owner = "Ada";
    const problems = problemsOf(
      expandMolecules([question("plan", [reference("wbs", "wbs-pert", data)])], source),
    );
    expect(problems.map(({ path }) => path)).toEqual([
      "/0/props/items/0/props/data/nodes/0/children/0/owner",
    ]);
  });

  test("props of the wrong shape are problems naming the reference, never an exception", () => {
    const cases: [unknown, string][] = [
      [null, "/0/props/items/0/props"],
      [{ molecule: "wbs-pert" }, "/0/props/items/0/props/data"],
      [{ molecule: "wbs-pert", version: "1.0", data: {} }, "/0/props/items/0/props/version"],
      [{ molecule: "wbs-pert", data: [] }, "/0/props/items/0/props/data"],
    ];
    for (const [props, path] of cases) {
      const items = [question("plan", [{ type: "molecule", id: "wbs", props }])];
      const problems = problemsOf(expandMolecules(items, source));
      expect(problems.map((problem) => [problem.itemId, problem.path])).toEqual([["wbs", path]]);
      expect(problems[0]?.message).toStartWith('the molecule reference "wbs": ');
    }
  });

  test("a reference with no ID is a problem at its place", () => {
    const items = [
      question("plan", [{ type: "molecule", props: { molecule: "wbs-pert", data: wbsData } }]),
    ];
    expect(problemsOf(expandMolecules(items, source))).toEqual([
      { path: "/0/props/items/0/id", message: "a molecule reference has no ID" },
    ]);
  });

  test("a definition whose parameters cannot be compiled refuses, never throws", () => {
    const uncompiled = copyOf(wbsPert) as unknown as { molecule: string; parameters: Json };
    uncompiled.molecule = "probe-uncompiled";
    uncompiled.parameters.$id = "urn:askboard:molecule:probe-uncompiled:1";
    uncompiled.parameters.wobble = 1;
    const broken = fakeMoleculeSource([uncompiled as unknown as typeof wbsPert]);
    const items = [question("plan", [reference("wbs", "probe-uncompiled", copyOf(wbsData))])];
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const problems = problemsOf(expandMolecules(items, broken.source));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatchObject({ itemId: "wbs", path: "/0/props/items/0/props/molecule" });
      expect(problems[0]?.message).toStartWith(
        'the molecule reference "wbs" names probe-uncompiled 1.0.0, whose parameters AskBoard cannot use: ',
      );
    }
  });

  test("with any problem, no items and no map are returned", () => {
    const items = [question("plan", [wbs(), reference("review", "sales-estimate-review", {})])];
    const result = expandMolecules(items, source);
    expect(result.ok).toBe(false);
    expect(Object.keys(result)).toEqual(["ok", "problems"]);
  });

  test("every problem is reported, in the order of the references", () => {
    const items = [
      question("plan", [
        reference("first", "sales-estimate-review", {}),
        reference("wbs", "wbs-pert", { nodes: [], calendar: 1 }),
      ]),
    ];
    expect(problemsOf(expandMolecules(items, source)).map(({ itemId }) => itemId)).toEqual([
      "first",
      "wbs",
    ]);
  });
});

describe("expanded IDs", () => {
  test("the limit is E1's: an ID of at most 64 characters", () => {
    expect(ID_PATTERN).toBe("^[A-Za-z0-9_-]{1,64}$");
  });

  test("a 59-character reference ID, whose expanded ID would have 65, is refused, naming the limit", () => {
    const id = "w".repeat(59);
    const items = [question("plan", [reference(id, "wbs-pert", copyOf(wbsData))])];
    expect(problemsOf(expandMolecules(items, source))).toEqual([
      {
        itemId: id,
        path: "/0/props/items/0/id",
        message: `the molecule reference "${id}" expands to the item "${id}__tree", of 65 characters, over the limit of 64 characters for an item ID`,
      },
    ]);
    const fits = [question("plan", [reference("w".repeat(58), "wbs-pert", copyOf(wbsData))])];
    expect(expandMolecules(fits, source).ok).toBe(true);
  });

  test("a clash with another item of the ask is refused, naming both", () => {
    for (const other of [
      { type: "tree", id: "wbs__tree", props: { nodes: [] } },
      question("wbs__tree", []),
    ]) {
      const items =
        other.type === "question"
          ? [question("plan", [wbs()]), other]
          : [question("plan", [wbs(), other])];
      expect(problemsOf(expandMolecules(items, source))).toEqual([
        {
          itemId: "wbs",
          path: "/0/props/items/0/id",
          message:
            'the molecule reference "wbs" expands to the item "wbs__tree", and another item of the ask has that ID',
        },
      ]);
    }
  });

  test("a clash with an item inside a layout, at depth one and four, is refused, naming the reference (review X-1)", () => {
    const clash = { type: "number-field", id: "wbs__tree", props: { label: "Days" } };
    const group = (id: string, ...items: unknown[]): Item => ({
      type: "group",
      id,
      props: { title: id, items },
    });
    const tabs = (id: string, ...items: unknown[]): Item => ({
      type: "tabs",
      id,
      props: {
        tabs: [
          { id: `${id}-a`, title: "A", items },
          { id: `${id}-b`, title: "B", items: [clash] },
        ],
      },
    });
    const four = group("g1", group("g2", group("g3", group("g4", clash))));
    for (const nested of [group("g", clash), four, tabs("t", { ...clash, id: "other" })]) {
      const items = [question("plan", [wbs(), nested])];
      expect(problemsOf(expandMolecules(items, source))).toEqual([
        {
          itemId: "wbs",
          path: "/0/props/items/0/id",
          message:
            'the molecule reference "wbs" expands to the item "wbs__tree", and another item of the ask has that ID',
        },
      ]);
    }
  });

  test("a layout holding no clash expands the reference beside it", () => {
    const quiet = { type: "number-field", id: "days", props: { label: "Days" } };
    const nested = { type: "group", id: "g", props: { title: "g", items: [quiet] } };
    expect(expandMolecules([question("plan", [wbs(), nested])], source).ok).toBe(true);
  });

  test("a clash with another reference's ID is refused too", () => {
    const items = [question("plan", [wbs(), reference("wbs__tree", "wbs-pert", copyOf(wbsData))])];
    expect(problemsOf(expandMolecules(items, source)).map(({ itemId }) => itemId)).toEqual(["wbs"]);
  });
});

describe("expansionEntries", () => {
  const map = expanded(expandMolecules([question("plan", [wbs(), schedule()])], source)).map;

  test("lists the map as frozen records, in the order of the references in the ask", () => {
    const entries = expansionEntries(map);
    expect(entries).toEqual([
      { itemId: "wbs__tree", reference: "wbs", molecule: "wbs-pert", version: "1.0.0" },
      {
        itemId: "schedule__plan",
        reference: "schedule",
        molecule: "probe-schedule",
        version: "1.2.0",
      },
    ]);
    expect(Object.isFrozen(entries)).toBe(true);
    for (const entry of entries) expect(Object.isFrozen(entry)).toBe(true);
  });

  test("changes nothing, and an empty map lists nothing", () => {
    const before = [...map];
    expansionEntries(map);
    expect([...map]).toEqual(before);
    const empty: ExpansionMap = new Map();
    expect(expansionEntries(empty)).toEqual([]);
  });
});

describe("the shipped definitions and step 4's widget checks", () => {
  const shipped = fakeMoleculeSource([wbsPert, ganttPlan]).source;
  const plan = (data: Json = copyOf(scheduleData)) => reference("schedule", "gantt-plan", data);
  const area = (id: string, questions: readonly unknown[]) => ({
    type: "area",
    id,
    props: { title: "Review", items: questions },
  });

  test("the approved UJ-2 items give uj2ExpandedQuestion in place, erp-export unchanged", () => {
    const result = expanded(expandMolecules(uj2Ask.items, shipped));
    const [question, other] = result.items;
    expect(question).toEqual(uj2ExpandedQuestion);
    expect(other).toBe(erpExport);
    expect([...result.map]).toEqual([
      ["wbs__tree", { reference: "wbs", molecule: "wbs-pert", version: "1.0.0" }],
      ["schedule__plan", { reference: "schedule", molecule: "gantt-plan", version: "1.0.0" }],
    ]);
  });

  test("data holding calendar is refused, naming schedule and calendar", () => {
    const items = [question("plan", [wbs(), plan({ ...copyOf(scheduleData), calendar: "EU" })])];
    expect(problemsOf(expandMolecules(items, shipped))).toEqual([
      {
        itemId: "schedule",
        path: "/0/props/items/1/props/data/calendar",
        message: expect.stringContaining('"schedule"'),
      },
    ]);
  });

  test("a plan in another question than wbs is refused at its link, naming schedule and wbs", () => {
    const items = [question("plan", [wbs()]), question("timeline", [plan()])];
    const problems = problemsOf(expandMolecules(items, shipped));
    expect(problems).toEqual([
      { itemId: "schedule", path: "/1/props/items/0", message: expect.any(String) },
    ]);
    const [problem] = problems;
    expect(problem?.message).toContain('"schedule"');
    expect(problem?.message).toContain("/workPackages");
    expect(problem?.message).toContain("wbs name no item");
    expect(problem?.message).not.toContain("__");
  });

  test("a start of 2026-02-30 passes the data check and is refused at step 4, at /start", () => {
    const data = { ...copyOf(scheduleData), start: "2026-02-30" };
    const items = [question("plan", [wbs(), plan(data)])];
    const problems = problemsOf(expandMolecules(items, shipped));
    expect(problems.map(({ itemId, path }) => ({ itemId, path }))).toEqual([
      { itemId: "schedule", path: "/0/props/items/1" },
    ]);
    expect(problems[0]?.message).toContain('"schedule"');
    expect(problems[0]?.message).toContain("/start");
    expect(problems[0]?.message).not.toContain("__");
  });

  test("a reference in an area's question expands in place there, the area otherwise unchanged", () => {
    const [planQuestion] = uj2Ask.items;
    const items = deepFreeze([area("review", [planQuestion]), area("export", [erpExport])]);
    const result = expanded(expandMolecules(items, shipped));
    const [review, exported] = result.items as readonly unknown[];
    expect(review).toEqual(area("review", [uj2ExpandedQuestion]));
    expect(exported).toBe(items[1]);
    expect([...result.map.keys()]).toEqual(["wbs__tree", "schedule__plan"]);
  });

  test("a problem in an area's question is placed through the area", () => {
    const data = { ...copyOf(scheduleData), calendar: "EU" };
    const items = [area("review", [question("plan", [wbs(), plan(data)])])];
    expect(problemsOf(expandMolecules(items, shipped)).map(({ path }) => path)).toEqual([
      "/0/props/items/0/props/items/1/props/data/calendar",
    ]);
    const elsewhere = [area("review", [question("plan", [wbs()]), question("timeline", [plan()])])];
    expect(problemsOf(expandMolecules(elsewhere, shipped)).map(({ path }) => path)).toEqual([
      "/0/props/items/1/props/items/0",
    ]);
  });

  test("an area's ID counts among the ask's item IDs", () => {
    const items = [area("wbs__tree", [question("plan", [wbs()])])];
    const problems = problemsOf(expandMolecules(items, shipped));
    expect(problems.map(({ itemId, path }) => ({ itemId, path }))).toEqual([
      { itemId: "wbs", path: "/0/props/items/0/props/items/0/id" },
    ]);
  });
});
