// The Timeline joins the registry and so the four sets (contract spec, "LaTeX, Kanban and Timeline
// in the sets' next minors"; latex-kanban-timeline, design decision 12): its item is admitted by
// the input format, the board document and `fetch`, its changes schema is in the output set, and
// it has no result schema; the earlier types refuse it.

import { describe, expect, test } from "bun:test";
import type { AnySchemaObject } from "ajv/dist/2020";
import { ATOM_TYPES } from "../src/fixtures/index.ts";
import { SCHEMA_SETS, TIMELINE_WIDGET, WIDGET_TYPES } from "../src/index.ts";
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

describe("the Timeline in the composed schemas", () => {
  test("the registry lists it right after the Kanban", () => {
    const types = WIDGET_TYPES.map(({ type }) => type);
    expect(types.indexOf("timeline")).toBe(types.indexOf("kanban") + 1);
    expect(types).toContain("timeline");
    // The atoms come after the Chart, which a later change registered after the Timeline, then the
    // layouts and the PickField.
    const atoms = ATOM_TYPES.map(({ type }) => type);
    const layouts = ["stack", "row", "group", "tabs", "pick-field", "document-review"];
    for (const type of types.slice(types.indexOf("chart") + 1)) {
      expect([...atoms, ...layouts]).toContain(type);
    }
  });

  test("a question's items take its item after the Kanban's and before the molecule reference", () => {
    const refs = refsOf(schemaOf("input", "urn:askboard:input:question-props"), "item");
    expect(refs.indexOf("timeline")).toBe(refs.indexOf("kanban") + 1);
    expect(refs.at(-1)).toBe("molecule");
    expect(schemaOf("input", "urn:askboard:input:timeline-props").additionalProperties).toBe(false);
  });

  test("the board document and fetch's result hold its item", () => {
    const document = schemaOf("board-document", "urn:askboard:board-document:board-document");
    expect(refsOf(document, "contextItem")).toContain("timeline");
    const fetchResult = schemaOf("tool-envelopes", "urn:askboard:tool-envelopes:fetch-result");
    expect(refsOf(fetchResult, "contextItem")).toContain("timeline");
    expect(fetchResult.$defs.item.properties.type.enum).toContain("timeline");
  });

  test("the output set lists its changes schema and no result schema", () => {
    const ids = (setOf("output").schemas as AnySchemaObject[]).map(({ $id }) => $id);
    expect(ids).toContain("urn:askboard:output:timeline-changes");
    expect(ids).not.toContain("urn:askboard:output:timeline-result");
  });
});

describe("the earlier types refuse a Timeline", () => {
  // The registry without the Timeline: what the previous minor admitted.
  const BEFORE = WIDGET_TYPES.filter(({ type }) => type !== "timeline");

  test("an ask holding one fails over them, naming the item and its type", () => {
    const { item } = TIMELINE_WIDGET.example;
    expect(askAccepted(BEFORE, item)).toBe(false);
    expect(widgetItemProblems(item, question(item), "agent", BEFORE)).toEqual([
      {
        path: "/",
        message: `item ${item.id} has the type "timeline", which is no widget the contract defines`,
      },
    ]);
  });

  test("the same ask passes over the shipped registry", () => {
    const { item } = TIMELINE_WIDGET.example;
    expect(askAccepted(WIDGET_TYPES, item)).toBe(true);
    expect(widgetItemProblems(item, question(item), "agent", WIDGET_TYPES)).toEqual([]);
  });
});

describe("the Timeline's schema descriptions", () => {
  test("none says it is in no schema set, and each names the format that holds it", () => {
    expect(TIMELINE_WIDGET.props.description).toEndWith(
      "In the input format since latex-kanban-timeline.",
    );
    expect(TIMELINE_WIDGET.edits?.changes.description).toEndWith(
      "In the output format since latex-kanban-timeline.",
    );
  });
});
