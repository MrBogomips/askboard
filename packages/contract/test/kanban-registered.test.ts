// The Kanban joins the registry and so the four sets (contract spec, "LaTeX, Kanban and Timeline in
// the sets' next minors"; latex-kanban-timeline, design decision 12): its item is admitted by the
// input format, the board document and `fetch`, its changes schema is in the output set, and it
// has no result schema; the earlier types refuse it.

import { describe, expect, test } from "bun:test";
import type { AnySchemaObject } from "ajv/dist/2020";
import { KANBAN_WIDGET, SCHEMA_SETS, WIDGET_TYPES, widgetRegistryProblems } from "../src/index.ts";
import { widgetItemProblems } from "../src/validate.ts";
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

describe("the Kanban in the composed schemas", () => {
  test("the registry lists it after the LaTeX", () => {
    const types = WIDGET_TYPES.map(({ type }) => type);
    expect(types.indexOf("kanban")).toBe(types.indexOf("latex") + 1);
  });

  test("a question's items take its item after the LaTeX's and before the molecule reference", () => {
    const refs = refsOf(schemaOf("input", "urn:askboard:input:question-props"), "item");
    expect(refs.indexOf("kanban")).toBe(refs.indexOf("latex") + 1);
    expect(refs.at(-1)).toBe("molecule");
    expect(schemaOf("input", "urn:askboard:input:kanban-props").additionalProperties).toBe(false);
  });

  test("the board document and fetch's result hold its item", () => {
    const document = schemaOf("board-document", "urn:askboard:board-document:board-document");
    expect(refsOf(document, "contextItem")).toContain("kanban");
    const fetchResult = schemaOf("tool-envelopes", "urn:askboard:tool-envelopes:fetch-result");
    expect(refsOf(fetchResult, "contextItem")).toContain("kanban");
    expect(fetchResult.$defs.item.properties.type.enum).toContain("kanban");
  });

  test("the output set lists its changes schema and no result schema", () => {
    const ids = (setOf("output").schemas as AnySchemaObject[]).map(({ $id }) => $id);
    expect(ids).toContain("urn:askboard:output:kanban-changes");
    expect(ids).not.toContain("urn:askboard:output:kanban-result");
  });
});

describe("the earlier types refuse a Kanban", () => {
  // The registry without the Kanban and the Timeline: what the previous minor admitted.
  const BEFORE = WIDGET_TYPES.filter(({ type }) => type !== "kanban" && type !== "timeline");

  test("an ask holding one fails over them, naming the item and its type", () => {
    const { item } = KANBAN_WIDGET.example;
    expect(askAccepted(BEFORE, item)).toBe(false);
    expect(widgetItemProblems(item, question(item), "agent", BEFORE)).toEqual([
      {
        path: "/",
        message: `item ${item.id} has the type "kanban", which is no widget the contract defines`,
      },
    ]);
  });

  test("the same ask passes over the shipped registry", () => {
    const { item } = KANBAN_WIDGET.example;
    expect(askAccepted(WIDGET_TYPES, item)).toBe(true);
    expect(widgetItemProblems(item, question(item), "agent", WIDGET_TYPES)).toEqual([]);
  });
});

describe("the Kanban's schema descriptions", () => {
  test("none says it is in no schema set, and each names the format that holds it", () => {
    expect(KANBAN_WIDGET.props.description).toEndWith(
      "In the input format since latex-kanban-timeline.",
    );
    expect(KANBAN_WIDGET.edits?.changes.description).toEndWith(
      "In the output format since latex-kanban-timeline.",
    );
  });
});

describe("the Kanban's teaching text of its order (kanban-order, design decision 9)", () => {
  const { skill } = KANBAN_WIDGET;
  const notes = (skill?.notes ?? []).join(" ");

  test("the use names the order within the columns, and each note is within the registry's bound", () => {
    expect(skill?.use).toContain("orders");
    expect(skill?.use.length).toBeLessThanOrEqual(200);
    for (const note of skill?.notes ?? []) {
      expect(note.length).toBeGreaterThanOrEqual(1);
      expect(note.length).toBeLessThanOrEqual(300);
    }
  });

  test("the notes say what the order of cards is and how to apply a set and a move", () => {
    expect(notes).toContain("`cards`");
    expect(notes).toContain("column's order, top to bottom");
    expect(notes).toContain("`move`");
    expect(notes).toContain("`after`");
    expect(notes).toContain("`set`");
    expect(notes).toContain("<id>.<card>.column");
    expect(notes).toContain("<id>.<card>`");
    expect(notes).toContain("in order");
    expect(notes).toContain("first in the list");
    expect(notes).toContain("did not reorder");
  });

  test("the registry still holds together", () => {
    expect(widgetRegistryProblems(WIDGET_TYPES)).toEqual([]);
  });
});
