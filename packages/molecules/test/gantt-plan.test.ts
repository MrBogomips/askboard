// The Gantt plan molecule (gantt-widget, task 7.5; molecules spec; design decision 6): its
// parameters as data, checked by the Gantt's own definitions. What its expansion gives is tested
// through `ask-core`'s expansion with the shipped definitions, in `molecule-source`.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { GANTT_MAX_TASKS, type MoleculeDefinition } from "@askboard/contract";
import {
  createAjv,
  moleculeDataValidator,
  problemOf,
  validateMoleculeDefinition,
} from "@askboard/contract/validate";
import { READY_MOLECULES } from "../src/index.ts";

const FILE = join(import.meta.dir, "../src/gantt-plan/gantt-plan.json");
const PARAMETERS_ID = "urn:askboard:molecule:gantt-plan:1";

// The approved examples, as E1's task 3.1 copied them into the contract's tests.
const ask = await Bun.file(
  join(import.meta.dir, "../../contract/test/fixtures/asks/uj2-wbs-gantt.json"),
).json();
const { data } = ask.items[0].props.items[1].props as { data: Record<string, unknown> };

const definition = JSON.parse(await Bun.file(FILE).text()) as MoleculeDefinition;

// Compiled as the contract compiles its schemas, strict, beside E1's ID schema and the Gantt's
// props schema, which the parameters reference; every strict-mode warning is kept.
const warnings: unknown[] = [];
const ajv = createAjv({ logger: { log() {}, warn: (...m) => warnings.push(m), error() {} } });
ajv.addSchema(definition.parameters);
const validate = ajv.getSchema(PARAMETERS_ID);
if (validate === undefined) throw new Error("the parameters are missing");

const problemsOf = (value: unknown) =>
  validate(value) ? [] : (validate.errors ?? []).map((error) => problemOf(error));

/** Every string in a JSON value, keys included. */
const strings = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, inner]) => [key, ...strings(inner)]);
};

describe("the Gantt plan's definition (molecules spec, The Gantt plan's parameters are data)", () => {
  test("is only data: exactly format, molecule, version, parameters, items and fills, no markup or script", () => {
    expect(Object.keys(definition)).toEqual([
      "format",
      "molecule",
      "version",
      "parameters",
      "items",
      "fills",
    ]);
    expect(definition).toMatchObject({ molecule: "gantt-plan", version: "1.0.0" });
    for (const text of strings(definition)) {
      expect({ text, markup: text.includes("<") }).toEqual({ text, markup: false });
      expect({ text, script: /javascript:/i.test(text) }).toEqual({ text, script: false });
    }
  });

  test("is a ready-made molecule, frozen", () => {
    expect(READY_MOLECULES).toContainEqual(definition);
    expect(Object.isFrozen(READY_MOLECULES)).toBe(true);
  });

  test("its parameters are JSON Schema 2020-12 with their $id, no root combinator", () => {
    const { parameters } = definition;
    expect(parameters.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(parameters.$id).toBe(PARAMETERS_ID);
    for (const keyword of ["oneOf", "anyOf", "allOf", "not", "if"]) {
      expect(keyword in parameters).toBe(false);
    }
    expect(parameters.required).toEqual(["workPackages", "start"]);
  });

  test("compile in strict mode with no warning, through the Gantt's definitions", () => {
    expect(warnings).toEqual([]);
    expect(strings(definition.parameters).filter((text) => text.startsWith("urn:"))).toEqual([
      PARAMETERS_ID,
      "urn:askboard:input:gantt-props#/properties/workPackages",
      "urn:askboard:input:gantt-props#/$defs/fullDate",
      "urn:askboard:input:id",
      "urn:askboard:input:gantt-props#/$defs/predecessors",
    ]);
  });

  test("accept the approved schedule data unchanged", () => {
    const before = structuredClone(data);
    expect(problemsOf(data)).toEqual([]);
    expect(data).toEqual(before);
    expect(problemsOf({ workPackages: "wbs", start: "2026-11-02" })).toEqual([]);
  });

  test("refuse calendar, naming it", () => {
    expect(problemsOf({ ...data, calendar: "EU" })).toEqual([
      { path: "/calendar", message: 'unknown field "calendar"' },
    ]);
  });

  test.each([
    ["no start", { workPackages: "wbs" }, "/start"],
    ["a start that is no date", { ...data, start: "2/11/2026" }, "/start"],
    ["work packages that are no ID", { ...data, workPackages: "w b s" }, "/workPackages"],
    ["a task that is no ID", { ...data, dependencies: { "a b": ["ux"] } }, "/dependencies"],
    [
      "a predecessor listed twice",
      { ...data, dependencies: { portal: ["ux", "ux"] } },
      "/dependencies/portal",
    ],
  ])("refuse %s, as the Gantt's props would", (_, value, path) => {
    const problems = problemsOf(value);
    expect({ problems, at: problems.some((problem) => problem.path === path) }).toMatchObject({
      at: true,
    });
  });

  test("refuse more dependencies than a plan holds entries, naming them", () => {
    const parameters = definition.parameters as {
      properties: { dependencies: { maxProperties?: number } };
    };
    expect(parameters.properties.dependencies.maxProperties).toBe(GANTT_MAX_TASKS);
    const entries = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, n) => [`t${n}`, ["ux"]]));
    expect(problemsOf({ ...data, dependencies: entries(GANTT_MAX_TASKS) })).toEqual([]);
    const problems = problemsOf({ ...data, dependencies: entries(GANTT_MAX_TASKS + 1) });
    expect(problems.map((problem) => problem.path)).toEqual(["/dependencies"]);
  });
});

describe("the Gantt plan in the molecule format (molecules spec, The Gantt plan's parameters are data)", () => {
  test("passes the definition format's checks", () => {
    expect(validateMoleculeDefinition(definition)).toEqual({ ok: true, value: definition });
    expect(definition.format).toBe("1.0.0");
  });

  test("its item is one Gantt plan with no entries", () => {
    expect(definition.items).toEqual([{ type: "gantt", id: "plan", props: { tasks: {} } }]);
  });

  test("fills the work packages as an item, the start as it is and the entries from dependencies", () => {
    expect(definition.fills).toEqual({
      workPackages: [{ pointer: "/0/props/workPackages", as: "item" }],
      start: [{ pointer: "/0/props/start" }],
      dependencies: [{ pointer: "/0/props/tasks", as: { entries: "dependencies" } }],
    });
  });

  test("its data validator accepts the approved schedule data and refuses calendar", () => {
    const validateData = moleculeDataValidator(definition);
    expect(validateData(data)).toEqual({ ok: true, value: data });
    expect(validateData({ ...data, calendar: "EU" })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/calendar", message: 'unknown field "calendar"' }],
    });
  });
});
