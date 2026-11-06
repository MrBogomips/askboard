// The widget-type registry (widget-registry, task 1.1; contract spec, "The widget-type registry"):
// the two entries and what they reuse, their examples, the test-only probe type and the registry's
// own check.

import { describe, expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { PROBE_TYPES, PROBE_WIDGET } from "../src/fixtures/index.ts";
import {
  GANTT_ANSWER_DERIVED,
  GANTT_PLAN_SHAPE,
  GANTT_SHAPE,
  ganttPropsSchema,
  type RegistryProblem,
  TREE_PERT_ANSWER_DERIVED,
  TREE_SHAPE,
  WIDGET_TYPES,
  type WidgetType,
  widgetRegistryProblems,
  widgetTypeOf,
} from "../src/index.ts";
import { validateAskRequest } from "../src/validate.ts";
import ganttChanges from "../src/widgets/gantt/gantt-changes.json" with { type: "json" };
import ganttProps from "../src/widgets/gantt/gantt-props.json" with { type: "json" };
import treeChanges from "../src/widgets/tree/tree-changes.json" with { type: "json" };
import treeProps from "../src/widgets/tree/tree-props.json" with { type: "json" };

const [TREE, GANTT] = WIDGET_TYPES as readonly [WidgetType, WidgetType];

const askHolding = (item: unknown) => ({
  askId: "registry-ask",
  items: [{ type: "question", id: "q", props: { text: "Does this fit?", items: [item] } }],
});

const rulesOf = (problems: readonly RegistryProblem[]) =>
  problems.map(({ type, rule }) => `${type}:${rule}`);

describe("the registry's entries", () => {
  test("hold the Tree then the Gantt, in that order", () => {
    expect(WIDGET_TYPES.map(({ type }) => type)).toEqual(["tree", "gantt"]);
    expect(TREE.noun).toBe("a Tree");
    expect(GANTT.noun).toBe("a Gantt");
  });

  test("reuse the existing schemas, as the same objects", () => {
    expect(TREE.props).toBe(treeProps);
    expect(TREE.edits?.changes).toBe(treeChanges);
    expect(GANTT.props).toBe(ganttProps);
    expect(GANTT.props).toBe(ganttPropsSchema);
    expect(GANTT.edits?.changes).toBe(ganttChanges);
  });

  test("give the shapes the generic diff takes today", () => {
    expect(TREE.edits?.shape({})).toBe(TREE_SHAPE);
    expect(GANTT.edits?.shape({ start: "2026-01-05", tasks: [] })).toBe(GANTT_SHAPE);
    expect(GANTT.edits?.shape({ start: "2026-01-05", workPackages: "wbs", tasks: {} })).toBe(
      GANTT_PLAN_SHAPE,
    );
  });

  test("declare no result and their derived values", () => {
    expect(TREE.result).toBeUndefined();
    expect(GANTT.result).toBeUndefined();
    expect(TREE.derived?.describe).toBeString();
    expect(GANTT.derived?.describe).toBeString();
    for (const key of Object.keys(GANTT_ANSWER_DERIVED)) {
      expect(GANTT.derived?.problem([key], {})).toBeUndefined();
    }
    for (const field of TREE_PERT_ANSWER_DERIVED.fields) {
      expect(TREE.derived?.problem([field], { pert: true, nodes: [] })).toBeUndefined();
    }
  });

  test("word the derived addresses a type does not declare, as ask-core did", () => {
    expect(GANTT.derived?.problem(["nothing"], {})).toBe(
      "a Gantt declares finish and criticalPath",
    );
    expect(TREE.derived?.problem(["expected"], { nodes: [] })).toBe(
      "a Tree declares derived values only with pert",
    );
    expect(TREE.derived?.problem(["a", "expected"], { pert: true, nodes: [{ id: "a" }] })).toBe(
      undefined,
    );
    expect(TREE.derived?.problem(["z", "expected"], { pert: true, nodes: [{ id: "a" }] })).toBe(
      "a Tree with pert declares expected and spread and its nodes'",
    );
  });

  test("hold each example, which passes in a question of an ask", () => {
    for (const { type, example } of WIDGET_TYPES) {
      expect(example.item.type).toBe(type);
      expect(validateAskRequest(askHolding(example.item)).ok).toBe(true);
    }
  });

  test("are found by type, and an inherited name is no type", () => {
    expect(widgetTypeOf("gantt")).toBe(GANTT);
    expect(widgetTypeOf("kanban")).toBeUndefined();
    expect(widgetTypeOf("constructor")).toBeUndefined();
    expect(widgetTypeOf(undefined)).toBeUndefined();
    expect(widgetTypeOf("probe", PROBE_TYPES)).toBe(PROBE_WIDGET);
  });
});

describe("widgetRegistryProblems", () => {
  test("passes on the registry and on the registry with the probe", () => {
    expect(widgetRegistryProblems(WIDGET_TYPES)).toEqual([]);
    expect(widgetRegistryProblems(PROBE_TYPES)).toEqual([]);
  });

  test("refuses a duplicate type, naming it", () => {
    const problems = widgetRegistryProblems([...PROBE_TYPES, PROBE_WIDGET]);
    expect(rulesOf(problems)).toEqual(["probe:duplicate"]);
    expect(problems[0]?.message).toContain("probe");
  });

  test.each(["excerpt", "reference", "image", "molecule", "question", "area"])(
    "refuses the reserved type %s",
    (type) => {
      const entry = { ...PROBE_WIDGET, type };
      expect(rulesOf(widgetRegistryProblems([entry]))).toContain(`${type}:reserved`);
    },
  );

  test("refuses a type outside the ID pattern", () => {
    const entry = { ...PROBE_WIDGET, type: "pro be" };
    expect(rulesOf(widgetRegistryProblems([entry]))).toContain("pro be:type");
  });

  test("refuses a props schema whose $id is not urn:askboard:input:<type>-props", () => {
    const entry = {
      ...PROBE_WIDGET,
      props: { ...PROBE_WIDGET.props, $id: "urn:askboard:input:x" },
    };
    const problems = widgetRegistryProblems([entry]);
    expect(rulesOf(problems)).toEqual(["probe:props-id"]);
    expect(problems[0]?.message).toContain("urn:askboard:input:probe-props");
  });

  test("refuses a changes schema and a result schema with a wrong $id", () => {
    const { edits, result } = PROBE_WIDGET;
    if (edits === undefined || result === undefined) throw new Error("the probe edits and answers");
    const entry = {
      ...PROBE_WIDGET,
      edits: { ...edits, changes: { ...edits.changes, $id: "urn:askboard:output:probe-result" } },
      result: { ...result, schema: { ...result.schema, $id: "urn:askboard:output:probe-x" } },
    };
    expect(rulesOf(widgetRegistryProblems([entry]))).toEqual([
      "probe:changes-id",
      "probe:result-id",
    ]);
  });

  test("refuses a wording key outside the type, an example of another type and an empty noun", () => {
    const entry: WidgetType = {
      ...PROBE_WIDGET,
      noun: "",
      wording: { ...PROBE_WIDGET.wording, expected: { "tree.props": "x" } },
      example: { item: { ...PROBE_WIDGET.example.item, type: "tree" } },
    };
    expect(rulesOf(widgetRegistryProblems([entry]))).toEqual([
      "probe:noun",
      "probe:wording",
      "probe:example",
    ]);
  });

  test("names the entry by position when its type is no string", () => {
    const entry = { ...PROBE_WIDGET, type: 7 as unknown as string };
    expect(widgetRegistryProblems([entry])[0]?.type).toBe("entry 0");
  });
});

describe("the probe type", () => {
  test("holds a props schema, a changes schema, a result schema and an example of its own", () => {
    expect(PROBE_WIDGET.props.$id).toBe("urn:askboard:input:probe-props");
    expect(PROBE_WIDGET.edits?.changes.$id).toBe("urn:askboard:output:probe-changes");
    expect(PROBE_WIDGET.result?.schema.$id).toBe("urn:askboard:output:probe-result");
    expect(PROBE_WIDGET.edits?.shape({ options: [] })).toEqual({ elements: "options" });
    expect(PROBE_TYPES).toEqual([...WIDGET_TYPES, PROBE_WIDGET]);
  });

  test("declares a count and refuses an option ID the item does not hold in a result", () => {
    const props = PROBE_WIDGET.example.item.props;
    expect(PROBE_WIDGET.derived?.problem(["count"], props)).toBeUndefined();
    expect(PROBE_WIDGET.derived?.problem(["total"], props)).toBeString();
    expect(PROBE_WIDGET.result?.problems?.({ pick: "a" }, props)).toEqual([]);
    expect(PROBE_WIDGET.result?.problems?.({ pick: "zz" }, props)).toEqual([
      { path: "/pick", message: 'the option "zz" is not one of the item\'s options' },
    ]);
  });
});

describe("the contract's property of importing", () => {
  const SRC = new URL("../src/", import.meta.url).pathname;
  const imports = {
    root: `await import("@askboard/contract")`,
    validate: `await import("@askboard/contract/validate")`,
    registry: `await import(${JSON.stringify(`${SRC}widgets/registry.ts`)})`,
  } as const;
  const ORDERS = [
    ["root", "validate", "registry"],
    ["validate", "registry", "root"],
    ["registry", "validate", "root"],
    ["registry", "root", "validate"],
  ] as const;

  test.each(ORDERS)(
    "a fresh process importing %s, %s then %s reads the registry",
    (first, second, third) => {
      const script = [
        ...[first, second, third].map((name) => imports[name]),
        `const { WIDGET_TYPES } = ${imports.registry};`,
        `console.log(JSON.stringify(WIDGET_TYPES.map((entry) => entry.type)));`,
      ].join(";\n");
      const run = Bun.spawnSync({
        cmd: [process.execPath, "-e", script],
        cwd: new URL("../../..", import.meta.url).pathname,
        stderr: "pipe",
      });
      expect(run.stderr.toString()).toBe("");
      expect(JSON.parse(run.stdout.toString())).toEqual(["tree", "gantt"]);
    },
  );
});

describe("the registry's import rule (design decision 1)", () => {
  // Every module the registry reaches by a runtime import: type-only imports are erased.
  const reached = async (entry: string): Promise<string[]> => {
    const transpiler = new Bun.Transpiler({ loader: "ts" });
    const seen = new Set<string>();
    const walk = async (file: string): Promise<void> => {
      if (seen.has(file) || !file.endsWith(".ts")) return;
      seen.add(file);
      for (const { path } of transpiler.scanImports(await Bun.file(file).text())) {
        if (path.startsWith(".")) await walk(resolve(dirname(file), path));
      }
    };
    await walk(entry);
    return [...seen].map((file) => file.slice(file.indexOf("/src/") + 5));
  };

  test("reaches no runtime value of validate.ts, sets.ts or a schema set module", async () => {
    const files = await reached(new URL("../src/widgets/registry.ts", import.meta.url).pathname);
    expect(files).toContain("widgets/tree/widget.ts");
    expect(files).toContain("widgets/gantt/widget.ts");
    const forbidden = files.filter(
      (file) => /^(validate|sets|compiled)\.ts$/.test(file) || file.startsWith("schemas/"),
    );
    expect(forbidden).toEqual([]);
  });
});
