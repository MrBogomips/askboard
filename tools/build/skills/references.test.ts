// The reference renderers (askboard-skills, design decisions 3 and 4; skills spec: a reference for
// each widget type, each ready molecule and the context items).

import { describe, expect, test } from "bun:test";
import { NON_WIDGET_ITEM_TYPES, WIDGET_TYPES } from "@askboard/contract";
import { PROBE_WIDGET } from "@askboard/contract/fixtures";
import { MOLECULE_SKILLS, type MoleculeSkill, READY_MOLECULES } from "@askboard/molecules";
import { taggedBlocks } from "./blocks.ts";
import { CONTEXT_TEACHING } from "./context-examples.ts";
import { contractSchemaResolver, type Schema } from "./fields.ts";
import {
  contextTypes,
  renderContextReference,
  renderMoleculeReference,
  renderWidgetReference,
} from "./references.ts";

const molecule = (name: string) => {
  const definition = READY_MOLECULES.find((entry) => entry.molecule === name);
  if (definition === undefined) throw new Error(`no molecule ${name}`);
  return definition;
};
const widget = (type: string) => {
  const entry = WIDGET_TYPES.find((candidate) => candidate.type === type);
  if (entry === undefined) throw new Error(`no widget ${type}`);
  return entry;
};
const resolve = contractSchemaResolver(
  READY_MOLECULES.map(({ parameters }) => parameters as Schema),
);

describe("the Gantt reference", () => {
  const gantt = widget("gantt");
  const { text } = renderWidgetReference(gantt, resolve);

  test("holds the note on the two forms of tasks and each form's limit", () => {
    expect(text).toContain(gantt.skill?.notes?.[0] ?? "unreachable");
    expect(text).toContain("`ownTasks` (at most 500 items)");
    expect(text).toContain("`planTasks` (at most 500 entries)");
  });
});

describe("renderWidgetReference", () => {
  const tree = widget("tree");
  const { text, examples } = renderWidgetReference(tree, resolve);

  test("holds the noun, the use, the shape line and every top-level field", () => {
    expect(text).toStartWith("# Tree\n");
    expect(text).toContain(tree.skill?.use ?? "unreachable");
    expect(text).toContain(tree.wording.expected["tree.props"] ?? "unreachable");
    for (const field of ["columns", "nodes", "pert", "openDepth"]) {
      expect(text).toContain(`- \`${field}\` (`);
    }
  });

  test("says what the answer carries: the edits and the derived values", () => {
    const answer = text.slice(text.indexOf("## In the answer"));
    expect(answer).toContain("`changes`");
    expect(answer).toContain(tree.derived?.describe ?? "unreachable");
    expect(answer).not.toContain("`results`");
  });

  test("holds the example item in a `json item` block, and returns it", () => {
    expect(taggedBlocks(text)).toEqual([{ kind: "item", value: tree.example.item }]);
    expect(examples).toEqual([{ kind: "item", value: tree.example.item }]);
  });

  test("renders the notes of an entry that has some, in order", () => {
    const withNotes = {
      ...tree,
      skill: { use: "a thing", notes: ["First note.", "Second note."] },
    };
    const rendered = renderWidgetReference(withNotes, resolve).text;
    expect(rendered.indexOf("- First note.")).toBeGreaterThan(0);
    expect(rendered.indexOf("- Second note.")).toBeGreaterThan(rendered.indexOf("- First note."));
  });

  test("gives a type with a result a section from its result schema", () => {
    const probe = { ...PROBE_WIDGET, skill: { use: "a pick among options" } };
    const rendered = renderWidgetReference(probe, contractSchemaResolver()).text;
    expect(rendered).toContain("`results`");
    expect(rendered).toContain("- `pick` (required");
    expect(rendered).toContain(PROBE_WIDGET.derived?.describe ?? "unreachable");
  });

  test("a type without teaching text fails, naming it", () => {
    expect(() => renderWidgetReference(PROBE_WIDGET, resolve)).toThrow(
      'the widget type "probe" has no teaching text',
    );
  });

  test("an entry that names a props schema outside the contract fails, naming the reference", () => {
    const broken = {
      ...tree,
      props: { $id: "urn:x", type: "object", properties: { a: { $ref: "urn:nowhere" } } },
    };
    expect(() => renderWidgetReference(broken, resolve)).toThrow("urn:nowhere");
  });
});

describe("renderMoleculeReference", () => {
  test("the WBS names its parameters, its version and holds a molecule reference", () => {
    const { text, examples } = renderMoleculeReference(
      molecule("wbs-pert"),
      MOLECULE_SKILLS,
      resolve,
    );
    expect(text).toContain("`wbs-pert`");
    expect(text).toContain(molecule("wbs-pert").version);
    expect(text).toContain("- `nodes` (required");
    expect(text).toContain("- `depth` (");
    expect(text).toContain(MOLECULE_SKILLS["wbs-pert"]?.use ?? "unreachable");
    expect(text).not.toMatch(/\((FR|AD)-\d/);
    const [block] = taggedBlocks(text);
    expect(block?.kind).toBe("item");
    expect(block?.value).toMatchObject({ type: "molecule", props: { molecule: "wbs-pert" } });
    expect(examples).toEqual(taggedBlocks(text));
  });

  test("a molecule that needs another's item is an `ask` example holding both references", () => {
    const { text } = renderMoleculeReference(
      molecule("gantt-plan"),
      MOLECULE_SKILLS,
      resolve,
      READY_MOLECULES,
    );
    const [block] = taggedBlocks(text);
    expect(block?.kind).toBe("ask");
    const ask = block?.value as { items: { props: { items: { id: string; props: unknown }[] } }[] };
    const items = ask.items[0]?.props.items ?? [];
    expect(items.map((item) => item.id)).toEqual(["wbs", "gantt"]);
    expect(items[1]?.props).toMatchObject({ molecule: "gantt-plan" });
    const first = items[0] as { id: string; props: { molecule?: string } };
    expect(first.props.molecule).toBe("wbs-pert");
    expect(first.id).toBe(MOLECULE_SKILLS["gantt-plan"]?.companion?.id ?? "unreachable");
  });

  test("a test-made companion is placed under companion.id, then the molecule's own item", () => {
    const skills = {
      ...MOLECULE_SKILLS,
      "wbs-pert": {
        ...(MOLECULE_SKILLS["wbs-pert"] as MoleculeSkill),
        companion: { molecule: "gantt-plan", id: "plan-src" },
      },
    };
    const { text } = renderMoleculeReference(
      molecule("wbs-pert"),
      skills,
      resolve,
      READY_MOLECULES,
    );
    const [block] = taggedBlocks(text);
    const ask = block?.value as { items: { props: { items: { id: string }[] } }[] };
    expect(ask.items[0]?.props.items.map(({ id }) => id)).toEqual(["plan-src", "wbs"]);
  });

  test("a companion that is not ready, or shares the molecule's item ID, fails naming both", () => {
    const own = MOLECULE_SKILLS["gantt-plan"] as MoleculeSkill;
    expect(() =>
      renderMoleculeReference(molecule("gantt-plan"), MOLECULE_SKILLS, resolve, []),
    ).toThrow('"gantt-plan" needs "wbs-pert"');
    const same = {
      ...MOLECULE_SKILLS,
      "gantt-plan": { ...own, companion: { molecule: "wbs-pert", id: "gantt" } },
    };
    expect(() =>
      renderMoleculeReference(molecule("gantt-plan"), same, resolve, READY_MOLECULES),
    ).toThrow('"gantt-plan" and its companion "wbs-pert" share the item ID "gantt"');
  });

  test("a molecule without teaching data fails, naming it", () => {
    expect(() => renderMoleculeReference(molecule("wbs-pert"), {}, resolve)).toThrow(
      'the molecule "wbs-pert" has no teaching data',
    );
  });
});

describe("renderContextReference", () => {
  const { text, examples } = renderContextReference(resolve);

  test("the context types come from the contract, each with teaching here", () => {
    expect(contextTypes()).toEqual(["excerpt", "reference", "image"]);
    for (const type of contextTypes()) expect(NON_WIDGET_ITEM_TYPES).toContain(type);
    expect(CONTEXT_TEACHING.map(({ type }) => type)).toEqual([...contextTypes()]);
  });

  test("lists each type with its fields and one example", () => {
    for (const type of contextTypes()) expect(text).toContain(`## ${type}`);
    expect(text).toContain("- `pointer` (");
    expect(text).toContain("- `alt` (required");
    expect(text).toContain("- `url` (");
    expect(examples).toHaveLength(3);
    expect(examples.map(({ kind }) => kind)).toEqual(["item", "item", "item"]);
    expect(examples).toEqual(taggedBlocks(text));
  });

  test("says that screenshots go under `.askboard/media/`", () => {
    expect(text).toContain("`.askboard/media/`");
  });

  test("gives the pointer the agent's note, not the contract's grammar note", () => {
    expect(text).toContain("A project file, relative to the project root");
    expect(text).not.toContain("readPointer");
    expect(text).not.toContain("Consistency Conventions");
  });

  test("fails when the contract has a context type with no teaching", () => {
    expect(() => renderContextReference(resolve, [...contextTypes(), "video"])).toThrow(
      'the context item type "video" has no teaching',
    );
  });
});
