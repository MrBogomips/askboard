// The `molecule-source` adapter (molecules design decision 5; board-host spec, "Molecule source",
// "Shipped definitions are checked before use"): the shipped definitions by name and by the
// version rule of AD-9, each molecule's definitions checked on its first lookup and never before.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import type { MoleculeDefinition } from "@askboard/contract";
import type { MoleculeLookup } from "@askboard/core";
import { READY_MOLECULES } from "@askboard/molecules";
import { createMoleculeSource } from "./index.ts";

const shippedNamed = (molecule: string): MoleculeDefinition => {
  const definition = READY_MOLECULES.find((each) => each.molecule === molecule);
  if (definition === undefined) throw new Error(`AskBoard ships no ${molecule}`);
  return definition;
};

const wbsPert = shippedNamed("wbs-pert");
const ganttPlan = shippedNamed("gantt-plan");

/** A copy of `base` named `molecule` at `version`, its parameters' `$id` following the major. */
const variant = (base: MoleculeDefinition, molecule: string, version: string) => {
  const copy = structuredClone(base) as MoleculeDefinition & { parameters: { $id: string } };
  return {
    ...copy,
    molecule,
    version,
    parameters: { ...copy.parameters, $id: `urn:askboard:molecule:${molecule}:${version[0]}` },
  } as MoleculeDefinition;
};

/** `definition` behind a proxy that records each top-level field read as `<name>.<field>`. */
const spied = (definition: MoleculeDefinition, name: string, reads: string[]) =>
  new Proxy(structuredClone(definition), {
    get: (target, key, receiver) => {
      reads.push(`${name}.${String(key)}`);
      return Reflect.get(target, key, receiver);
    },
  });

const UNDECLARED_FILL =
  'the fills name the parameter "calendar", which the parameters do not declare';

describe("the molecule source over the shipped definitions", () => {
  const source = createMoleculeSource();

  test("wbs-pert with no version gives the shipped wbs-pert 1.0.0", () => {
    expect(source.lookup("wbs-pert")).toEqual({ found: true, definition: wbsPert });
    expect(source.lookup("wbs-pert")).toMatchObject({ definition: { version: "1.0.0" } });
  });

  test("wbs-pert 1.0.0 gives it", () => {
    expect(source.lookup("wbs-pert", "1.0.0")).toEqual({ found: true, definition: wbsPert });
  });

  test("gantt-plan with no version gives the shipped gantt-plan 1.0.0", () => {
    expect(source.lookup("gantt-plan")).toEqual({ found: true, definition: ganttPlan });
  });

  test("wbs-pert 2.0.0 is an unknown version, naming the shipped 1.0.0", () => {
    expect(source.lookup("wbs-pert", "2.0.0")).toEqual({
      found: false,
      reason: "unknown-version",
      shipped: ["1.0.0"],
    });
  });

  test("an unshipped molecule is unknown, naming both shipped molecules", () => {
    expect(source.lookup("sales-estimate-review")).toEqual({
      found: false,
      reason: "unknown-molecule",
      shipped: ["gantt-plan", "wbs-pert"],
    });
  });
});

describe("the version rule", () => {
  const source = createMoleculeSource([
    variant(wbsPert, "probe-versions", "1.2.0"),
    variant(wbsPert, "probe-versions", "2.1.0"),
    variant(wbsPert, "probe-versions", "1.0.0"),
  ]);
  const versionOf = (version?: string) => {
    const lookup = source.lookup("probe-versions", version);
    return lookup.found ? lookup.definition.version : lookup.reason;
  };

  test("with no version, the highest shipped version of the highest major", () => {
    expect(versionOf()).toBe("2.1.0");
  });

  test("with one, the highest shipped version of its major at or above it", () => {
    expect(versionOf("1.0.0")).toBe("1.2.0");
    expect(versionOf("1.2.0")).toBe("1.2.0");
    expect(versionOf("2.0.0")).toBe("2.1.0");
    expect(versionOf("2.1.0")).toBe("2.1.0");
  });

  test("a version above every shipped one of its major, or of a major not shipped, is unknown", () => {
    for (const version of ["1.3.0", "1.2.1", "2.1.1", "3.0.0", "0.9.0"]) {
      expect(source.lookup("probe-versions", version)).toEqual({
        found: false,
        reason: "unknown-version",
        shipped: ["1.0.0", "1.2.0", "2.1.0"],
      });
    }
  });

  test("a version that is not MAJOR.MINOR.PATCH is unknown", () => {
    for (const version of ["1.0", "01.0.0", "latest", ""]) {
      expect(versionOf(version)).toBe("unknown-version");
    }
  });

  test("each part compares as a number", () => {
    const tenth = createMoleculeSource([
      variant(wbsPert, "probe-versions", "1.9.0"),
      variant(wbsPert, "probe-versions", "1.10.0"),
    ]);
    const lookup = tenth.lookup("probe-versions", "1.9.1");
    expect(lookup.found && lookup.definition.version).toBe("1.10.0");
  });
});

describe("checks before use", () => {
  test("making the source reads and checks no definition", () => {
    const reads: string[] = [];
    createMoleculeSource([spied(wbsPert, "wbs", reads), spied(ganttPlan, "gantt", reads)]);
    expect(reads).toEqual([]);
  });

  test("the first lookup of a molecule checks only its definitions, and only once", () => {
    const reads: string[] = [];
    const source = createMoleculeSource([
      spied(wbsPert, "wbs", reads),
      spied(ganttPlan, "gantt", reads),
    ]);
    expect(source.lookup("wbs-pert")).toMatchObject({ found: true });
    expect(reads).toContain("wbs.fills");
    expect(reads).toContain("wbs.parameters");
    expect(reads.filter((read) => read.startsWith("gantt."))).toEqual(["gantt.molecule"]);
    const afterFirst = [...reads];
    expect(source.lookup("wbs-pert", "1.0.0")).toMatchObject({ found: true });
    expect(source.lookup("wbs-pert", "2.0.0")).toMatchObject({ reason: "unknown-version" });
    expect(reads).toEqual(afterFirst);
  });

  test("an unknown molecule checks no definition", () => {
    const reads: string[] = [];
    const source = createMoleculeSource([spied(wbsPert, "wbs", reads)]);
    expect(source.lookup("sales-estimate-review")).toMatchObject({ reason: "unknown-molecule" });
    expect(reads).toEqual(["wbs.molecule"]);
  });

  test("a fill from an undeclared parameter is broken, naming the molecule and the fill, every time", () => {
    const broken = structuredClone(wbsPert) as MoleculeDefinition & { fills: object };
    broken.fills = { ...broken.fills, calendar: [{ pointer: "/0/props/calendar" }] };
    const source = createMoleculeSource([broken, ganttPlan]);
    const refusal: MoleculeLookup = {
      found: false,
      reason: "broken",
      shipped: ["1.0.0"],
      detail: `wbs-pert 1.0.0 fails the definition format's checks at /fills/calendar: ${UNDECLARED_FILL}`,
    };
    expect(source.lookup("wbs-pert")).toEqual(refusal);
    expect(source.lookup("wbs-pert", "1.0.0")).toEqual(refusal);
    expect(source.lookup("gantt-plan")).toEqual({ found: true, definition: ganttPlan });
  });

  test("a definition in format 2.0.0 is broken, naming the format", () => {
    const source = createMoleculeSource([{ ...wbsPert, format: "2.0.0" }]);
    const lookup = source.lookup("wbs-pert");
    expect(lookup).toMatchObject({ found: false, reason: "broken", shipped: ["1.0.0"] });
    expect(lookup.found ? "" : lookup.detail).toStartWith(
      "wbs-pert 1.0.0 fails the definition format's checks at /format: the definition follows molecule format 2.0.0, which is not supported",
    );
  });

  test("a molecule with one broken definition serves none of its versions", () => {
    const broken = variant(wbsPert, "probe-versions", "2.0.0") as MoleculeDefinition & {
      fills: object;
    };
    broken.fills = { ...broken.fills, calendar: [{ pointer: "/0/props/calendar" }] };
    const source = createMoleculeSource([variant(wbsPert, "probe-versions", "1.0.0"), broken]);
    for (const version of [undefined, "1.0.0", "2.0.0"]) {
      expect(source.lookup("probe-versions", version)).toEqual({
        found: false,
        reason: "broken",
        shipped: ["1.0.0", "2.0.0"],
        detail: `probe-versions 2.0.0 fails the definition format's checks at /fills/calendar: ${UNDECLARED_FILL}`,
      });
    }
  });
});

describe("only shipped molecules", () => {
  test("the adapter imports no file system, process or network module", async () => {
    const source = await Bun.file(join(import.meta.dir, "index.ts")).text();
    const imports = new Bun.Transpiler({ loader: "ts" })
      .scanImports(source)
      .map(({ path }) => path);
    expect(imports.length).toBeGreaterThan(0);
    for (const path of imports) expect(path).toStartWith("@askboard/");
  });
});
