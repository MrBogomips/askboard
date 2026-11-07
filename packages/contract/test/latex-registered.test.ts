// The LaTeX joins the registry and so the four sets it widens (contract spec, "LaTeX, Kanban and
// Timeline in the sets' next minors"; latex-kanban-timeline, design decisions 12 and 13): each
// version is one minor past main's, bound at task 7.2.

import { describe, expect, test } from "bun:test";
import type { AnySchemaObject } from "ajv/dist/2020";
import {
  BOARD_DOCUMENT_VERSION,
  INPUT_FORMAT_VERSION,
  LATEX_WIDGET,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SETS,
  TOOL_ENVELOPES_VERSION,
  WIDGET_TYPES,
} from "../src/index.ts";
import { widgetItemProblems } from "../src/validate.ts";
import { unsupportedVersion } from "../src/versions.ts";
import { APPROVAL_WIDGET } from "../src/widgets/approval/widget.ts";
import { GANTT_WIDGET } from "../src/widgets/gantt/widget.ts";
import { RANKING_WIDGET } from "../src/widgets/ranking/widget.ts";
import { SCALE_WIDGET } from "../src/widgets/scale/widget.ts";
import { TREE_WIDGET } from "../src/widgets/tree/widget.ts";
import { askAccepted, question } from "./result-widgets-support.ts";

const setOf = (name: string) => {
  const set = SCHEMA_SETS.find((candidate) => candidate.name === name);
  if (set === undefined) throw new Error(`no set ${name}`);
  return set;
};

const schemaOf = (set: string, id: string): AnySchemaObject => {
  const found = (setOf(set).schemas as AnySchemaObject[]).find((schema) => schema.$id === id);
  if (found === undefined) throw new Error(`no schema ${id} in ${set}`);
  return found;
};

const refsOf = (schema: AnySchemaObject, union: string): string[] =>
  schema.$defs[union].oneOf.map(({ $ref }: { $ref: string }) => $ref.split("/").at(-1));

describe("the versions of the four sets latex-kanban-timeline widens", () => {
  test("each is one minor past main's, and the sets hold the constants", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
    }).toEqual({ input: "1.7", output: "1.7", envelopes: "1.7", document: "1.6" });
    expect(setOf("input").version).toBe(INPUT_FORMAT_VERSION);
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
    expect(setOf("tool-envelopes").version).toBe(TOOL_ENVELOPES_VERSION);
    expect(setOf("board-document").version).toBe(BOARD_DOCUMENT_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    for (const [name, previous] of [
      ["input", "1.6"],
      ["output", "1.6"],
      ["tool-envelopes", "1.6"],
      ["board-document", "1.5"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous)).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0")).toBeDefined();
    }
  });

  test("each set module's header names this change", async () => {
    for (const module of ["input", "output", "tool-envelopes", "board-document"]) {
      const text = await Bun.file(
        new URL(`../src/schemas/${module}/index.ts`, import.meta.url),
      ).text();
      const header = text.split("\nimport ")[0] as string;
      expect(header, module).toContain("latex-kanban-timeline");
    }
  });
});

describe("the LaTeX in the composed schemas", () => {
  test("the registry lists it after the Ranking", () => {
    expect(WIDGET_TYPES.map(({ type }) => type).slice(0, 6)).toEqual([
      "tree",
      "gantt",
      "approval",
      "scale",
      "ranking",
      "latex",
    ]);
  });

  test("a question's items take its item after the Ranking's and before the molecule reference", () => {
    const refs = refsOf(schemaOf("input", "urn:askboard:input:question-props"), "item");
    expect(refs.slice(3, 9)).toEqual(["tree", "gantt", "approval", "scale", "ranking", "latex"]);
    expect(refs.at(-1)).toBe("molecule");
    expect(schemaOf("input", "urn:askboard:input:latex-props").additionalProperties).toBe(false);
  });

  test("the board document and fetch's result hold its item", () => {
    const document = schemaOf("board-document", "urn:askboard:board-document:board-document");
    expect(refsOf(document, "contextItem")).toContain("latex");
    const fetchResult = schemaOf("tool-envelopes", "urn:askboard:tool-envelopes:fetch-result");
    expect(refsOf(fetchResult, "contextItem")).toContain("latex");
    expect(fetchResult.$defs.item.properties.type.enum).toContain("latex");
  });

  test("the output set lists its changes schema and no result schema", () => {
    const ids = (setOf("output").schemas as AnySchemaObject[]).map(({ $id }) => $id);
    expect(ids).toContain("urn:askboard:output:latex-changes");
    expect(ids).not.toContain("urn:askboard:output:latex-result");
  });
});

describe("the previous minor refuses a LaTeX", () => {
  const PREVIOUS = [TREE_WIDGET, GANTT_WIDGET, APPROVAL_WIDGET, SCALE_WIDGET, RANKING_WIDGET];

  test("an ask holding one fails over the earlier types, naming the item and its type", () => {
    const { item } = LATEX_WIDGET.example;
    expect(askAccepted(PREVIOUS, item)).toBe(false);
    expect(widgetItemProblems(item, question(item), "agent", PREVIOUS)).toEqual([
      {
        path: "/",
        message: `item ${item.id} has the type "latex", which is no widget the contract defines`,
      },
    ]);
  });

  test("the same ask passes over the shipped registry", () => {
    const { item } = LATEX_WIDGET.example;
    expect(askAccepted(WIDGET_TYPES, item)).toBe(true);
    expect(widgetItemProblems(item, question(item), "agent", WIDGET_TYPES)).toEqual([]);
  });
});

describe("the LaTeX's schema descriptions", () => {
  test("none says it is in no schema set, and each names the format that holds it", () => {
    expect(LATEX_WIDGET.props.description).toEndWith(
      "In the input format since latex-kanban-timeline.",
    );
    expect(LATEX_WIDGET.edits?.changes.description).toEndWith(
      "In the output format since latex-kanban-timeline.",
    );
  });
});

describe("the LaTeX's teaching text", () => {
  test("names the refused commands: macro definitions, words holding @, \\show and \\char with a backquote", () => {
    const notes = (LATEX_WIDGET.skill?.notes ?? []).join("\n");
    expect(notes).toContain("\\def");
    expect(notes).toContain("@");
    expect(notes).toContain("\\show");
    expect(notes).toContain("\\char`");
    for (const note of LATEX_WIDGET.skill?.notes ?? []) {
      expect(note.length).toBeLessThanOrEqual(300);
    }
  });
});
