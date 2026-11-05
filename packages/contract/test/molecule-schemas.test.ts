import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { SCHEMA_IDS, SCHEMA_SETS } from "../src/index.ts";
import {
  EXPANDED_ID_SEPARATOR,
  expandedItemId,
  MOLECULE_FORMAT_VERSION,
  MOLECULE_FORMATS_SUPPORTED,
  MOLECULE_NAME_PATTERN,
  MOLECULE_VERSION_PATTERN,
} from "../src/molecules/index.ts";
import moleculeDefinition from "../src/molecules/molecule-definition.json" with { type: "json" };
import moleculeProps from "../src/molecules/molecule-props.json" with { type: "json" };
import { createAjv, type Problem, problemOf } from "../src/validate.ts";
import { copyOf, probePlan, probeWbs } from "./molecule-probes.ts";

// The molecule formats' standalone schemas (design decision 2), compiled in strict mode in an Ajv
// made by `createAjv()`, which holds E1's ID schema. They belong to no set until the input format
// reaches 1.1, so the Consistency Conventions' shape rules are checked here directly.
const PROPS = "urn:askboard:input:molecule-props";
const DEFINITION = "urn:askboard:input:molecule-definition";
const DIALECT = "https://json-schema.org/draft/2020-12/schema";

type Json = Record<string, unknown>;

const ajv = createAjv();
ajv.addSchema(moleculeProps);
ajv.addSchema(moleculeDefinition);

const problemsOf = (id: string, value: unknown): Problem[] => {
  const validate = ajv.getSchema(id);
  if (validate === undefined) throw new Error(`no schema ${id}`);
  return validate(value) ? [] : (validate.errors ?? []).map(problemOf);
};
const pathsOf = (id: string, value: unknown) => problemsOf(id, value).map(({ path }) => path);

const ask = (await Bun.file(join(import.meta.dir, "fixtures/asks/uj2-wbs-gantt.json")).json()) as {
  items: { id: string; props: { items?: { id: string; props: Json }[] } }[];
};
const referenceProps = (id: string): Json => {
  const plan = ask.items.find((item) => item.id === "plan");
  const reference = plan?.props.items?.find((item) => item.id === id);
  if (reference === undefined) throw new Error(`no reference ${id}`);
  return reference.props;
};

describe("the molecule formats' schemas (design decision 2)", () => {
  test("both compile in strict mode beside E1's schemas", () => {
    expect(ajv.opts.strict).toBe(true);
    expect(typeof ajv.getSchema(PROPS)).toBe("function");
    expect(typeof ajv.getSchema(DEFINITION)).toBe("function");
  });

  test("each is JSON Schema 2020-12 with its $id in the input format's namespace", () => {
    expect(moleculeProps.$schema).toBe(DIALECT);
    expect(moleculeDefinition.$schema).toBe(DIALECT);
    expect(moleculeProps.$id).toBe(PROPS);
    expect(moleculeDefinition.$id).toBe(DEFINITION);
  });

  test.each(["oneOf", "anyOf", "allOf"])("neither has a root %s", (keyword) => {
    expect(keyword in moleculeProps).toBe(false);
    expect(keyword in moleculeDefinition).toBe(false);
  });

  test("no schema set and no SCHEMA_IDS entry holds either $id", () => {
    const ids = SCHEMA_SETS.flatMap((set) => set.schemas.map((schema) => (schema as Json).$id));
    for (const id of [PROPS, DEFINITION]) {
      expect(ids).not.toContain(id);
      expect(Object.values(SCHEMA_IDS)).not.toContain(id);
    }
  });

  test("both schemas state the contract's name and version patterns", () => {
    expect(moleculeProps.properties.molecule.pattern).toBe(MOLECULE_NAME_PATTERN);
    expect(moleculeProps.properties.version.pattern).toBe(MOLECULE_VERSION_PATTERN);
    expect(moleculeDefinition.$defs.name.pattern).toBe(MOLECULE_NAME_PATTERN);
    expect(moleculeDefinition.$defs.version.pattern).toBe(MOLECULE_VERSION_PATTERN);
  });
});

describe("molecule-props", () => {
  test("the approved UJ-2 references' props validate unchanged", () => {
    const wbs = referenceProps("wbs");
    const schedule = referenceProps("schedule");
    const before = JSON.stringify([wbs, schedule]);
    expect(problemsOf(PROPS, wbs)).toEqual([]);
    expect(problemsOf(PROPS, schedule)).toEqual([]);
    expect(JSON.stringify([wbs, schedule])).toBe(before);
  });

  test("a version that is not MAJOR.MINOR.PATCH fails, naming version", () => {
    for (const version of ["1.0", "1", "1.0.0-beta", "v1.0.0", "01.0.0", "1.0.00", 1]) {
      expect(pathsOf(PROPS, { molecule: "wbs-pert", version, data: {} })).toEqual(["/version"]);
    }
    expect(problemsOf(PROPS, { molecule: "wbs-pert", version: "12.0.3", data: {} })).toEqual([]);
  });

  test("props without data fail, naming data", () => {
    expect(problemsOf(PROPS, { molecule: "wbs-pert" })).toEqual([
      { path: "/data", message: 'missing field "data"' },
    ]);
    expect(pathsOf(PROPS, { molecule: "wbs-pert", data: [] })).toEqual(["/data"]);
  });

  test("an unknown key fails, naming it", () => {
    expect(problemsOf(PROPS, { molecule: "wbs-pert", data: {}, layout: "wide" })).toEqual([
      { path: "/layout", message: 'unknown field "layout"' },
    ]);
  });

  test("a molecule name outside the pattern fails, naming molecule", () => {
    for (const molecule of ["", "Wbs", "wbs_pert", "1wbs", "w".repeat(65)]) {
      expect(pathsOf(PROPS, { molecule, data: {} })).toEqual(["/molecule"]);
    }
    expect(problemsOf(PROPS, { molecule: "w".repeat(64), data: {} })).toEqual([]);
  });
});

describe("molecule-definition", () => {
  test("definitions with each fill form validate", () => {
    expect(problemsOf(DEFINITION, probeWbs)).toEqual([]);
    expect(problemsOf(DEFINITION, probePlan)).toEqual([]);
  });

  test("every top-level key is required, and an unknown one fails", () => {
    for (const key of ["format", "molecule", "version", "parameters", "items", "fills"]) {
      const { [key]: _, ...rest } = probeWbs as Json;
      expect(problemsOf(DEFINITION, rest)).toEqual([
        { path: `/${key}`, message: `missing field "${key}"` },
      ]);
    }
    expect(problemsOf(DEFINITION, { ...probeWbs, code: "x" })).toEqual([
      { path: "/code", message: 'unknown field "code"' },
    ]);
  });

  test("two items fail, and so does none", () => {
    const [item] = probeWbs.items;
    expect(pathsOf(DEFINITION, { ...probeWbs, items: [item, { ...item, id: "other" }] })).toEqual([
      "/items",
    ]);
    expect(pathsOf(DEFINITION, { ...probeWbs, items: [] })).toEqual(["/items"]);
  });

  test("an item with an unknown key, a bad ID or no props fails, naming it", () => {
    const [item] = copyOf(probeWbs.items);
    expect(problemsOf(DEFINITION, { ...probeWbs, items: [{ ...item, style: "red" }] })).toEqual([
      { path: "/items/0/style", message: 'unknown field "style"' },
    ]);
    expect(pathsOf(DEFINITION, { ...probeWbs, items: [{ ...item, id: "a b" }] })).toEqual([
      "/items/0/id",
    ]);
    const { props: _, ...bare } = item as Json;
    expect(pathsOf(DEFINITION, { ...probeWbs, items: [bare] })).toEqual(["/items/0/props"]);
  });

  test("fills with an unknown form fail, at the form", () => {
    for (const as of ["eval", { expression: "1+1" }, { entries: "x", omit: ["y"] }, { omit: [] }]) {
      const fills = { depth: [{ pointer: "/0/props/openDepth", as }] };
      const paths = pathsOf(DEFINITION, { ...probeWbs, fills });
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.every((path) => path.startsWith("/fills/depth/0/as"))).toBe(true);
    }
  });

  test("a fill needs a JSON Pointer, and a parameter at least one fill", () => {
    for (const pointer of ["", "0/props", "/0/~2", "/0/~"]) {
      const fills = { depth: [{ pointer }] };
      expect(pathsOf(DEFINITION, { ...probeWbs, fills })).toEqual(["/fills/depth/0/pointer"]);
    }
    expect(pathsOf(DEFINITION, { ...probeWbs, fills: { depth: [] } })).toEqual(["/fills/depth"]);
    const extra = { depth: [{ pointer: "/0/props/openDepth", when: "always" }] };
    expect(pathsOf(DEFINITION, { ...probeWbs, fills: extra })).toEqual(["/fills/depth/0/when"]);
  });

  test("a format or version that is not MAJOR.MINOR.PATCH fails, naming it", () => {
    expect(pathsOf(DEFINITION, { ...probeWbs, format: "1.0" })).toEqual(["/format"]);
    expect(pathsOf(DEFINITION, { ...probeWbs, version: "1" })).toEqual(["/version"]);
  });
});

describe("the formats' constants", () => {
  test("format 1.0.0, read by a contract that supports major 1", () => {
    expect(MOLECULE_FORMAT_VERSION).toBe("1.0.0");
    expect(MOLECULE_FORMATS_SUPPORTED).toEqual([1]);
    expect(Object.isFrozen(MOLECULE_FORMATS_SUPPORTED)).toBe(true);
  });

  test("an expanded item's ID is the reference's ID, two underscores and the item's (AD-9)", () => {
    expect(EXPANDED_ID_SEPARATOR).toBe("__");
    expect(expandedItemId("wbs", "tree")).toBe("wbs__tree");
    expect(expandedItemId("schedule", "plan")).toBe("schedule__plan");
  });
});
