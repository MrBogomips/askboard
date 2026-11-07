// The TextField and the Toggle join the registry and so the sets (atoms, task 5.3; contract spec:
// TextField items and results, Toggle items and results, Atom types in the registry; design decision
// 11): their items are admitted by the input format, the board document and `fetch`, their result
// schemas are in the output format, which moves to the next minor after `main`'s with the first
// registered result, and the earlier registry refuses them.

import { describe, expect, test } from "bun:test";
import type { AnySchemaObject } from "ajv/dist/2020";
import {
  ATOM_TYPES,
  TEXT_FIELD_FIXTURE_ITEMS,
  TOGGLE_FIXTURE_ITEM,
} from "../src/fixtures/index.ts";
import {
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SETS,
  TEXT_FIELD_WIDGET,
  TOGGLE_WIDGET,
  WIDGET_TYPES,
} from "../src/index.ts";
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

describe("the output format's minor", () => {
  test("the first registered result moves it to the next minor after main's, and the set carries it", () => {
    // main's output format at the base is 1.7 (atoms, design decision 11; bound at task 7.2).
    expect(OUTPUT_FORMAT_VERSION).toBe("1.8");
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
  });
});

describe("the TextField and the Toggle in the registry", () => {
  test("they follow the display atoms, in the fixtures' order", () => {
    const types = WIDGET_TYPES.map(({ type }) => type);
    expect(types.indexOf("text-field")).toBe(types.indexOf("divider") + 1);
    const atoms = ATOM_TYPES.map(({ type }) => type);
    const held = types.filter((type) => atoms.includes(type));
    expect(held).toEqual(atoms.filter((type) => held.includes(type)));
    expect(types).toContain("toggle");
  });

  test("a question's items take their items before the molecule reference", () => {
    const refs = refsOf(schemaOf("input", "urn:askboard:input:question-props"), "item");
    for (const type of ["text-field", "toggle"]) expect(refs).toContain(type);
    expect(refs.at(-1)).toBe("molecule");
    expect(schemaOf("input", "urn:askboard:input:text-field-props").additionalProperties).toBe(
      false,
    );
  });

  test("the board document and fetch's result hold their items", () => {
    const document = schemaOf("board-document", "urn:askboard:board-document:board-document");
    const fetchResult = schemaOf("tool-envelopes", "urn:askboard:tool-envelopes:fetch-result");
    for (const type of ["text-field", "toggle"]) {
      expect(refsOf(document, "contextItem")).toContain(type);
      expect(refsOf(fetchResult, "contextItem")).toContain(type);
      expect(fetchResult.$defs.item.properties.type.enum).toContain(type);
    }
  });

  test("the output set lists their result schemas, each since atoms, and none for the display atoms", () => {
    const ids = (setOf("output").schemas as AnySchemaObject[]).map(({ $id }) => $id);
    expect(ids).toContain("urn:askboard:output:text-field-result");
    expect(ids).toContain("urn:askboard:output:toggle-result");
    for (const type of ["text", "value", "divider"]) {
      expect(ids).not.toContain(`urn:askboard:output:${type}-result`);
    }
    for (const entry of [TEXT_FIELD_WIDGET, TOGGLE_WIDGET]) {
      expect(entry.result?.schema.description).toEndWith("In the output format since atoms.");
    }
  });
});

describe("the earlier registry refuses them", () => {
  const BEFORE = WIDGET_TYPES.filter(({ type }) => type !== "text-field" && type !== "toggle");

  test("an ask holding one fails over it, naming the item and its type", () => {
    for (const { item } of [TEXT_FIELD_WIDGET.example, TOGGLE_WIDGET.example]) {
      expect(askAccepted(BEFORE, item), item.type).toBe(false);
      expect(widgetItemProblems(item, question(item), "agent", BEFORE)).toEqual([
        {
          path: "/",
          message: `item ${item.id} has the type "${item.type}", which is no widget the contract defines`,
        },
      ]);
    }
  });

  test("the same asks pass over the shipped registry, the fixtures included", () => {
    for (const item of [
      TEXT_FIELD_WIDGET.example.item,
      TOGGLE_WIDGET.example.item,
      ...TEXT_FIELD_FIXTURE_ITEMS,
      TOGGLE_FIXTURE_ITEM,
    ]) {
      expect(askAccepted(WIDGET_TYPES, item), item.id).toBe(true);
      expect(widgetItemProblems(item, question(item), "agent", WIDGET_TYPES)).toEqual([]);
    }
  });
});
