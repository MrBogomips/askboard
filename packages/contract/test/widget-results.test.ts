// Result declarations and the annotation (widget-registry, task 2.1; contract spec, "Widget result
// declarations" and "The annotation shape"): the generic result check over the registry (the
// type's schema by `$id`, then its checks against the props), the annotation schema with its six
// selectors, and `annotationProblems`.

import { describe, expect, test } from "bun:test";
import { PROBE_TYPES, PROBE_WIDGET } from "../src/fixtures/index.ts";
import { SCHEMA_SETS } from "../src/sets.ts";
import { type Problem, validateAgainst } from "../src/validate.ts";
import { WIDGET_TYPES } from "../src/widgets/registry.ts";
import { annotationProblems, widgetResultProblems } from "../src/widgets/results.ts";

const PROBE = PROBE_WIDGET.example.item;
const probeItem = { type: "probe", id: PROBE.id };

const resultProblems = (item: { type: string; id: string }, result: unknown, props: unknown) =>
  widgetResultProblems(item, result, props, PROBE_TYPES);

describe("a probe result", () => {
  test("a result the probe's schema and checks admit passes", () => {
    expect(resultProblems(probeItem, { pick: "a" }, PROBE.props)).toEqual([]);
  });

  test("an option the item does not hold fails, naming the item and the option", () => {
    const problems = resultProblems(probeItem, { pick: "zz" }, PROBE.props);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe("/pick");
    expect(problems[0]?.message).toContain("pick");
    expect(problems[0]?.message).toContain('"zz"');
  });

  test("a result the schema refuses fails by the schema, and the checks do not run", () => {
    const missing = resultProblems(probeItem, {}, PROBE.props);
    expect(missing.map((problem) => problem.path)).toEqual(["/pick"]);
    expect(missing[0]?.message).toContain('missing field "pick"');
    const extra = resultProblems(probeItem, { pick: "a", more: 1 }, PROBE.props);
    expect(extra.map((problem) => problem.path)).toEqual(["/more"]);
    const wrongType = resultProblems(probeItem, "a", PROBE.props);
    expect(wrongType).not.toEqual([]);
  });

  test("the checks read the props they are given: the edited ones, not the sent ones", () => {
    const edited = { options: [{ id: "c", label: "C" }] };
    expect(resultProblems(probeItem, { pick: "c" }, edited)).toEqual([]);
    expect(resultProblems(probeItem, { pick: "a" }, edited)).not.toEqual([]);
  });

  test("a result held as JSON text of a schema the sets do not hold is checked the same twice", () => {
    expect(resultProblems(probeItem, { pick: "a" }, PROBE.props)).toEqual([]);
    expect(resultProblems(probeItem, { pick: "a" }, PROBE.props)).toEqual([]);
  });
});

describe("a type that gives no result", () => {
  test.each([
    ["tree", "a Tree gives no result"],
    ["gantt", "a Gantt gives no result"],
  ])("a result for %s fails, saying so", (type, said) => {
    const problems = widgetResultProblems({ type, id: "wbs" }, { pick: "a" }, {});
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe("/");
    expect(problems[0]?.message).toContain(said);
    expect(problems[0]?.message).toContain("wbs");
  });

  test("a result for a type the registry does not hold fails, naming the item and the type", () => {
    const problems = widgetResultProblems({ type: "kanban", id: "board" }, {}, {});
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain("board");
    expect(problems[0]?.message).toContain("kanban");
  });

  test("the Tree and the Gantt declare no result, every type approval-scale-ranking adds does, and so does the probe", () => {
    expect(
      WIDGET_TYPES.map(({ type, result }) => [type, result === undefined] as const).filter(
        ([type]) => type === "tree" || type === "gantt",
      ),
    ).toEqual([
      ["tree", true],
      ["gantt", true],
    ]);
    for (const { type, result } of WIDGET_TYPES.slice(2)) {
      expect([type, result !== undefined]).toEqual([type, true]);
    }
    expect(PROBE_WIDGET.result).toBeDefined();
    // The probe is no shipped type: the default registry refuses its result.
    expect(widgetResultProblems(probeItem, { pick: "a" }, PROBE.props)).toHaveLength(1);
  });

  test("a result of an entry that has a schema and no checks passes by its schema alone", () => {
    const schema = { ...PROBE_WIDGET.result?.schema, $id: "urn:askboard:output:plain-result" };
    const plain = {
      ...PROBE_WIDGET,
      type: "plain",
      result: { schema },
    };
    expect(widgetResultProblems({ type: "plain", id: "x" }, { pick: "a" }, {}, [plain])).toEqual(
      [],
    );
    expect(widgetResultProblems({ type: "plain", id: "x" }, { pick: 1 }, {}, [plain])).not.toEqual(
      [],
    );
  });
});

describe("the output format lists the results and the annotation", () => {
  const ids = SCHEMA_SETS.find((set) => set.name === "output")?.schemas.map(
    (schema) => (schema as { $id: string }).$id,
  );

  test("the annotation is a schema of the output format", () => {
    expect(ids).toContain("urn:askboard:output:annotation");
  });

  test("each registered entry's result schema is listed (none shipped yet)", () => {
    for (const { result } of WIDGET_TYPES) {
      if (result !== undefined) expect(ids).toContain(result.schema.$id);
    }
  });
});

const ANNOTATION = "urn:askboard:output:annotation";

const annotation = (selector: unknown, text = "Too vague") => ({
  id: "n1",
  target: { selector },
  body: { text },
});

const SELECTORS = {
  element: { type: "element", id: "node-3" },
  label: { type: "label", label: "Open item", occurrence: 2 },
  region: { type: "region", value: "xywh=percent:10,20,30.5,40" },
  line: { type: "line", side: "new", path: "src/a.ts", line: 12 },
  quote: { type: "quote", exact: "the quick fox", prefix: "see ", suffix: " jumps" },
  position: { type: "position", start: 3, end: 9 },
} as const;

const problemsOf = (value: unknown): readonly Problem[] => {
  const checked = validateAgainst(ANNOTATION, value);
  return checked.ok ? [] : checked.problems;
};

describe("the annotation shape", () => {
  test.each(Object.entries(SELECTORS))(
    "an annotation with a %s selector passes",
    (_name, selector) => {
      expect(problemsOf(annotation(selector))).toEqual([]);
      expect(annotationProblems(annotation(selector))).toEqual([]);
    },
  );

  test("the optional fields may be left out", () => {
    expect(problemsOf(annotation({ type: "label", label: "x" }))).toEqual([]);
    expect(problemsOf(annotation({ type: "quote", exact: "x" }))).toEqual([]);
  });

  test("a region in pixels fails at the selector's value", () => {
    const problems = problemsOf(annotation({ type: "region", value: "xywh=pixel:10,10,40,40" }));
    expect(problems.map((problem) => problem.path)).toContain("/target/selector/value");
  });

  test("a selector of type css fails at its type", () => {
    const problems = problemsOf(annotation({ type: "css", value: "a" }));
    expect(problems.map((problem) => problem.path)).toEqual(["/target/selector/type"]);
  });

  test("a text of 0 or over 2,000 characters, and an unknown field, fail", () => {
    expect(problemsOf(annotation(SELECTORS.element, ""))).not.toEqual([]);
    expect(problemsOf(annotation(SELECTORS.element, "x".repeat(2001)))).not.toEqual([]);
    expect(problemsOf(annotation(SELECTORS.element, "x".repeat(2000)))).toEqual([]);
    expect(problemsOf({ ...annotation(SELECTORS.element), extra: 1 }).map((p) => p.path)).toEqual([
      "/extra",
    ]);
    expect(problemsOf({ id: "n1", body: { text: "x" } }).map((p) => p.path)).toEqual(["/target"]);
  });

  test("the selectors' limits", () => {
    const bad = (selector: unknown) => problemsOf(annotation(selector)).length > 0;
    expect(bad({ type: "label", label: "" })).toBe(true);
    expect(bad({ type: "label", label: "x".repeat(201) })).toBe(true);
    expect(bad({ type: "label", label: "x", occurrence: 0 })).toBe(true);
    expect(bad({ type: "label", label: "x", occurrence: 1.5 })).toBe(true);
    expect(bad({ type: "line", side: "left", path: "a", line: 1 })).toBe(true);
    expect(bad({ type: "line", side: "old", path: "a", line: 0 })).toBe(true);
    expect(bad({ type: "quote", exact: "" })).toBe(true);
    expect(bad({ type: "quote", exact: "x", prefix: "p".repeat(201) })).toBe(true);
    expect(bad({ type: "position", start: -1, end: 2 })).toBe(true);
    expect(bad({ type: "element", id: "a b" })).toBe(true);
    expect(bad({ type: "region", value: "xywh=percent:1,2,3" })).toBe(true);
  });

  test("an annotation's id is an element ID", () => {
    expect(problemsOf({ ...annotation(SELECTORS.element), id: "a b" })).not.toEqual([]);
  });
});

describe("what the schema cannot say", () => {
  const position = (start: number, end: number) =>
    annotationProblems(annotation({ type: "position", start, end }));
  const region = (value: string) => annotationProblems(annotation({ type: "region", value }));

  test("a start after the end fails, naming the selector's start", () => {
    const problems = position(9, 3);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.path).toBe("/target/selector/start");
    expect(position(3, 3)).toEqual([]);
  });

  test("a region past 100% fails, naming the selector's value", () => {
    for (const value of [
      "xywh=percent:90,0,20,10",
      "xywh=percent:0,95,10,10",
      "xywh=percent:101,0,1,1",
      "xywh=percent:0,0,100.5,10",
    ]) {
      const problems = region(value);
      expect(problems).toHaveLength(1);
      expect(problems[0]?.path).toBe("/target/selector/value");
    }
    expect(region("xywh=percent:0,0,100,100")).toEqual([]);
    expect(region("xywh=percent:25.5,10,74.5,90")).toEqual([]);
  });

  test("the other selectors have nothing beyond the schema", () => {
    expect(annotationProblems(annotation(SELECTORS.label))).toEqual([]);
    expect(annotationProblems(annotation(SELECTORS.quote))).toEqual([]);
  });

  test("a value that is no annotation, or has a region with no value, yields no throw", () => {
    expect(annotationProblems(null)).toEqual([]);
    expect(annotationProblems({ target: { selector: { type: "region" } } })).toEqual([]);
    expect(annotationProblems({ target: { selector: { type: "position", start: "a" } } })).toEqual(
      [],
    );
  });
});
