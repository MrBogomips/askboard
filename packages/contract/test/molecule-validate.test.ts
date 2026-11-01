import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { compiled } from "../src/compiled.ts";
import {
  MOLECULE_FORMAT_VERSION,
  type MoleculeDefinition,
  type MoleculeProps,
  moleculeDefinitionProblems,
  SCHEMA_IDS,
  SCHEMA_SETS,
} from "../src/index.ts";
import {
  validateAgainst,
  validateMoleculeDefinition,
  validateMoleculeProps,
} from "../src/validate.ts";
import { copyOf, probePlan, probeWbs } from "./molecule-probes.ts";

// The molecule formats' validators (design decision 2): each the shared widget validator of its
// schema, then, for a definition, the format's major and item count first and its checks last,
// returning E1's `Checked` with problems in E1's shape.
const PROPS = "urn:askboard:input:molecule-props";
const DEFINITION = "urn:askboard:input:molecule-definition";

type Json = Record<string, unknown>;

const moleculeIdsOfE1 = () =>
  Object.keys(compiled().schemas).filter((id) => id.startsWith("urn:askboard:molecule"));

// First in this file, before either validator runs here: E1's shared validator never learns a
// molecule schema, so the order of test files does not matter.
describe("the contract's shared validator (spec, No import-time effects in the contract)", () => {
  test("knows neither format's $id when the contract is imported, nor after both validators run", () => {
    for (const id of [PROPS, DEFINITION]) {
      expect(() => validateAgainst(id, {})).toThrow(`the contract has no schema ${id}`);
    }
    expect(validateMoleculeProps({ molecule: "wbs-pert", data: {} }).ok).toBe(true);
    expect(validateMoleculeDefinition(probeWbs).ok).toBe(true);
    for (const id of [PROPS, DEFINITION]) {
      expect(() => validateAgainst(id, {})).toThrow(`the contract has no schema ${id}`);
    }
    expect(moleculeIdsOfE1()).toEqual([]);
    const ids = SCHEMA_SETS.flatMap((set) => set.schemas.map((s) => (s as { $id: string }).$id));
    for (const id of [PROPS, DEFINITION]) {
      expect([...ids, ...Object.values(SCHEMA_IDS)]).not.toContain(id);
    }
  });
});

describe("validateMoleculeProps", () => {
  test("passes the approved UJ-2 references' props, returning them", async () => {
    const path = join(import.meta.dir, "fixtures/asks/uj2-wbs-gantt.json");
    const ask = (await Bun.file(path).json()) as {
      items: { id: string; props: { items?: { props: MoleculeProps }[] } }[];
    };
    const references = ask.items.flatMap((item) => item.props.items ?? []);
    expect(references).toHaveLength(2);
    for (const { props } of references) {
      expect(validateMoleculeProps(props)).toEqual({ ok: true, value: props });
    }
  });

  test("refuses in E1's shape, naming the field", () => {
    expect(validateMoleculeProps({ molecule: "wbs-pert", version: "1.0", data: {} })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/version", message: expect.stringContaining("pattern") }],
    });
    expect(validateMoleculeProps({ molecule: "wbs-pert" })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/data", message: 'missing field "data"' }],
    });
    expect(validateMoleculeProps("wbs-pert")).toMatchObject({ ok: false, reason: "schema" });
  });
});

describe("validateMoleculeDefinition", () => {
  test("passes a definition that follows every rule, returning it", () => {
    expect(validateMoleculeDefinition(probeWbs)).toEqual({ ok: true, value: probeWbs });
    expect(validateMoleculeDefinition(probePlan)).toEqual({ ok: true, value: probePlan });
  });

  test("another format's major is refused first, naming the formats this contract reads", () => {
    for (const format of ["2.0.0", "0.9.0"]) {
      expect(validateMoleculeDefinition({ ...probeWbs, format, items: [], extra: 1 })).toEqual({
        ok: false,
        reason: "version",
        problems: [
          {
            path: "/format",
            message: `the definition follows molecule format ${format}, which is not supported: this contract reads format 1 (${MOLECULE_FORMAT_VERSION})`,
          },
        ],
      });
    }
    expect(validateMoleculeDefinition({ ...probeWbs, format: "1.4.0" }).ok).toBe(true);
  });

  test("a format that is no version is the schema's to name", () => {
    expect(validateMoleculeDefinition({ ...probeWbs, format: "one" })).toMatchObject({
      ok: false,
      reason: "schema",
      problems: [{ path: "/format" }],
    });
  });

  test("two items, or none, are refused, saying that format 1.0.0 composes one item", () => {
    const [item] = probeWbs.items;
    expect(validateMoleculeDefinition({ ...probeWbs, items: [item, item] })).toEqual({
      ok: false,
      reason: "schema",
      problems: [
        {
          path: "/items",
          message: "molecule format 1.0.0 composes exactly one item, and this definition holds 2",
        },
      ],
    });
    expect(validateMoleculeDefinition({ ...probeWbs, items: [] })).toMatchObject({
      ok: false,
      problems: [{ path: "/items", message: expect.stringContaining("holds 0") }],
    });
  });

  test("a schema problem comes before any check runs", () => {
    const definition = copyOf(probeWbs) as unknown as Json;
    (definition.fills as Json).calendar = [{ pointer: "/0/props/calendar", as: "eval" }];
    const checked = validateMoleculeDefinition(definition);
    expect(checked.ok).toBe(false);
    const paths = checked.ok ? [] : checked.problems.map(({ path }) => path);
    expect(paths.every((path) => path.startsWith("/fills/calendar/0/as"))).toBe(true);
  });

  test("then the checks' problems, as moleculeDefinitionProblems gives them", () => {
    const definition = copyOf(probeWbs) as unknown as Json;
    (definition.fills as Json).calendar = [{ pointer: "/0/props/calendar" }];
    (definition.parameters as Json).description = "<b>Nodes</b>";
    const problems = moleculeDefinitionProblems(definition as unknown as MoleculeDefinition);
    expect(problems).toHaveLength(2);
    expect(validateMoleculeDefinition(definition)).toEqual({
      ok: false,
      reason: "schema",
      problems,
    });
  });

  test("never throws on what is no definition", () => {
    for (const value of [null, "definition", 1, [], { items: "none" }]) {
      expect(validateMoleculeDefinition(value)).toMatchObject({ ok: false, reason: "schema" });
    }
  });
});
