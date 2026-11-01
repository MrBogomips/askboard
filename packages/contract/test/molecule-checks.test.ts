import { describe, expect, test } from "bun:test";
import { moleculeDefinitionProblems } from "../src/molecules/checks.ts";
import type { MoleculeDefinition } from "../src/molecules/index.ts";
import { copyOf, probePlan, probeWbs } from "./molecule-probes.ts";

// What a definition's schema cannot say (design decision 2; contract spec, "Molecule definition
// format", "Molecule fills", "Molecules carry no code"), on definitions that pass the schema.
// Each problem is E1's `{path, message}`, at a JSON Pointer into the definition.

type Json = Record<string, unknown>;

const wbs = (): Json => copyOf(probeWbs) as unknown as Json;
const plan = (): Json => copyOf(probePlan) as unknown as Json;
const problemsOf = (definition: Json) =>
  moleculeDefinitionProblems(definition as unknown as MoleculeDefinition);
const pathsOf = (definition: Json) => problemsOf(definition).map(({ path }) => path);
const parametersOf = (definition: Json) => definition.parameters as Json;

describe("a definition that follows every rule", () => {
  test("has no problem, whatever its fill forms", () => {
    expect(problemsOf(wbs())).toEqual([]);
    expect(problemsOf(plan())).toEqual([]);
  });

  test("is not changed by the checks", () => {
    const definition = wbs();
    const before = JSON.stringify(definition);
    problemsOf(definition);
    expect(JSON.stringify(definition)).toBe(before);
  });
});

describe("the parameters", () => {
  test("a root combinator fails, naming the parameters", () => {
    for (const keyword of ["anyOf", "oneOf", "allOf"]) {
      const definition = wbs();
      parametersOf(definition)[keyword] = [{ required: ["nodes"] }];
      const problems = problemsOf(definition);
      expect(problems).toHaveLength(1);
      expect(problems[0]?.path).toBe(`/parameters/${keyword}`);
      expect(problems[0]?.message).toContain(`${keyword} at their root`);
    }
  });

  test("parameters that are not JSON Schema 2020-12 fail, naming $schema", () => {
    for (const dialect of [undefined, "http://json-schema.org/draft-07/schema#"]) {
      const definition = wbs();
      parametersOf(definition).$schema = dialect;
      expect(problemsOf(definition)).toEqual([
        {
          path: "/parameters/$schema",
          message:
            "the parameters are not JSON Schema 2020-12 (https://json-schema.org/draft/2020-12/schema)",
        },
      ]);
    }
  });

  test("an $id other than urn:askboard:molecule:<name>:<major> fails, naming the expected one", () => {
    for (const id of [
      undefined,
      "urn:askboard:molecule:probe-wbs:1.2.0",
      "urn:askboard:molecule:probe-wbs:2",
      "urn:askboard:molecule:gantt-plan:1",
      "urn:askboard:input:probe-wbs",
    ]) {
      const definition = wbs();
      parametersOf(definition).$id = id;
      expect(problemsOf(definition)).toEqual([
        {
          path: "/parameters/$id",
          message: `the parameters' $id is ${JSON.stringify(id ?? null)}, where this definition's is "urn:askboard:molecule:probe-wbs:1"`,
        },
      ]);
    }
  });

  test("parameters that are no object schema fail, naming type", () => {
    const definition = plan();
    parametersOf(definition).type = "array";
    expect(pathsOf(definition)).toEqual(["/parameters/type"]);
  });

  test("parameters with no properties leave every fill undeclared", () => {
    const definition = plan();
    delete parametersOf(definition).properties;
    parametersOf(definition).required = [];
    expect(pathsOf(definition)).toEqual([
      "/fills/workPackages",
      "/fills/start",
      "/fills/dependencies",
    ]);
  });
});

describe("the fills", () => {
  test("a fill from an undeclared parameter fails, naming it", () => {
    const definition = plan();
    (definition.fills as Json).calendar = [{ pointer: "/0/props/calendar" }];
    expect(problemsOf(definition)).toEqual([
      {
        path: "/fills/calendar",
        message: 'the fills name the parameter "calendar", which the parameters do not declare',
      },
    ]);
  });

  test("an inherited name is no declared parameter", () => {
    const definition = plan();
    const inherited: string = "toString";
    (definition.fills as Record<string, unknown>)[inherited] = [{ pointer: "/0/props/other" }];
    expect(pathsOf(definition)).toEqual(["/fills/toString"]);
  });

  test("a pointer whose parent is missing fails, naming the pointer", () => {
    const definition = plan();
    (definition.fills as Json).start = [{ pointer: "/0/props/schedule/start" }];
    expect(problemsOf(definition)).toEqual([
      {
        path: "/fills/start/0/pointer",
        message:
          'the pointer "/0/props/schedule/start" names no place in the composition: "/0/props/schedule" holds nothing to fill',
      },
    ]);
  });

  test("a pointer below a value that holds no keys fails, saying what it holds", () => {
    const definition = wbs();
    (definition.fills as Json).depth = [{ pointer: "/0/props/openDepth/levels" }];
    expect(problemsOf(definition)).toEqual([
      {
        path: "/fills/depth/0/pointer",
        message:
          'the pointer "/0/props/openDepth/levels" names no place in the composition: "/0/props/openDepth" holds a number, not an object or a list',
      },
    ]);
  });

  test("a pointer into a list needs an index the list has", () => {
    const definition = wbs();
    (definition.fills as Json).depth = [{ pointer: "/0/props/columns/0" }];
    expect(problemsOf(definition)).toEqual([]);
    for (const index of ["1", "-", "01"]) {
      (definition.fills as Json).depth = [{ pointer: `/0/props/columns/${index}` }];
      expect(pathsOf(definition)).toEqual(["/fills/depth/0/pointer"]);
    }
  });

  test("a pointer outside the item's props fails: the ID is the expansion's, the type the definition's", () => {
    for (const pointer of ["/0", "/0/id", "/0/type", "/1/props/x"]) {
      const definition = wbs();
      (definition.fills as Json).depth = [{ pointer }];
      const problems = problemsOf(definition);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toEqual({
        path: "/fills/depth/0/pointer",
        message: `the pointer "${pointer}" is outside the item's props: a fill fills /0/props or a place inside it`,
      });
    }
    const whole = wbs();
    whole.fills = { depth: [{ pointer: "/0/props" }] };
    expect(problemsOf(whole)).toEqual([]);
  });

  test("two fills on one pointer fail, naming both parameters", () => {
    const definition = plan();
    (definition.fills as Json).start = [{ pointer: "/0/props/workPackages" }];
    expect(problemsOf(definition)).toEqual([
      {
        path: "/fills/start/0/pointer",
        message: 'the parameter "workPackages" fills the pointer "/0/props/workPackages" already',
      },
    ]);
    const twice = plan();
    (twice.fills as Json).start = [{ pointer: "/0/props/start" }, { pointer: "/0/props/start" }];
    expect(pathsOf(twice)).toEqual(["/fills/start/1/pointer"]);
  });

  test("a pointer inside another fill's place fails, named at the later of the two", () => {
    const inner = plan();
    (inner.fills as Json).start = [{ pointer: "/0/props/tasks/x" }];
    expect(problemsOf(inner)).toEqual([
      {
        path: "/fills/dependencies/0/pointer",
        message:
          'the pointer "/0/props/tasks" holds "/0/props/tasks/x", which the parameter "start" fills',
      },
    ]);
    const outer = plan();
    (outer.fills as Json).start = [{ pointer: "/0/props" }];
    expect(problemsOf(outer)).toEqual([
      {
        path: "/fills/start/0/pointer",
        message:
          'the pointer "/0/props" holds "/0/props/workPackages", which the parameter "workPackages" fills',
      },
      {
        path: "/fills/dependencies/0/pointer",
        message:
          'the pointer "/0/props/tasks" lies inside "/0/props", which the parameter "start" fills',
      },
    ]);
  });

  test("an item fill on an object slot fails; on a string or an absent key it passes", () => {
    const definition = plan();
    (definition.fills as Json).dependencies = [{ pointer: "/0/props/tasks", as: "item" }];
    expect(problemsOf(definition)).toEqual([
      {
        path: "/fills/dependencies/0/pointer",
        message:
          'the item fill\'s pointer "/0/props/tasks" holds an object, where an item fill fills text or a key the composition leaves out',
      },
    ]);
    const onString = plan();
    (onString.fills as Json).workPackages = [{ pointer: "/0/props/start", as: "item" }];
    (onString.fills as Json).start = [{ pointer: "/0/props/begin" }];
    expect(problemsOf(onString)).toEqual([]);
  });

  test("pointers unescape ~1 and ~0 before they are resolved", () => {
    const definition = plan();
    const [item] = definition.items as Json[];
    (item as Json).props = { start: "2026-01-05", tasks: {}, "a/b": {}, "c~d": "x" };
    definition.fills = {
      workPackages: [{ pointer: "/0/props/c~0d", as: "item" }],
      start: [{ pointer: "/0/props/a~1b/start" }],
    };
    expect(problemsOf(definition)).toEqual([]);
    definition.fills = { start: [{ pointer: "/0/props/a/b/start" }] };
    expect(pathsOf(definition)).toEqual(["/fills/start/0/pointer"]);
    definition.fills = { workPackages: [{ pointer: "/0/props/a~1b", as: "item" }] };
    expect(pathsOf(definition)).toEqual(["/fills/workPackages/0/pointer"]);
  });
});

describe("molecules carry no code", () => {
  test("a description holding <script> fails, naming the path of that string", () => {
    const definition = wbs();
    const nodes = (parametersOf(definition).properties as Json).nodes as Json;
    nodes.description = "Work packages <script>alert(1)</script>";
    expect(problemsOf(definition)).toEqual([
      {
        path: "/parameters/properties/nodes/description",
        message: 'the text holds markup ("<"), and a molecule carries no markup or script',
      },
    ]);
  });

  test("a javascript: URL fails in any case and across tabs and line breaks, naming its path", () => {
    for (const text of [
      "JAVASCRIPT:alert(1)",
      "see javascript:void(0)",
      "java\tscript:x",
      "java\nScript:x",
    ]) {
      const definition = wbs();
      const [item] = definition.items as Json[];
      ((item as Json).props as Json).columns = [
        { field: "optimistic", label: text, type: "number" },
      ];
      expect(problemsOf(definition)).toEqual([
        {
          path: "/items/0/props/columns/0/label",
          message: "the text holds a javascript: URL, and a molecule carries no markup or script",
        },
      ]);
    }
  });

  test("a key holding markup fails, naming its place", () => {
    const definition = wbs();
    const [item] = definition.items as Json[];
    ((item as Json).props as Json)["<b>"] = 1;
    expect(problemsOf(definition)).toEqual([
      {
        path: "/items/0/props/<b>",
        message: 'the key holds markup ("<"), and a molecule carries no markup or script',
      },
    ]);
  });

  test("text that names JavaScript with no URL, or compares numbers in words, passes", () => {
    const definition = wbs();
    parametersOf(definition).description = "Data only, no JavaScript; depth less than 9.";
    expect(problemsOf(definition)).toEqual([]);
  });
});
