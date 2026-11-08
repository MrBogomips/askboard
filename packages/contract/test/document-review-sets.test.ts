// The four sets document-review widens (contract spec: The Document review in the sets' next minors;
// design decisions 11 and 13): the input format, the tool envelopes and the board document each take
// the next minor after main's when the type joins the registry in task 6.3, the output format having
// taken its minor in task 1.1; every other set keeps main's. The numbers are labels bound here and
// in the constants only (askboard-contract-versioning, Rule 1); task 8.2 binds them again.

import { describe, expect, test } from "bun:test";
import type { AnySchemaObject } from "ajv/dist/2020";
import { documentReviewFetchItemResult } from "../src/fixtures/index.ts";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  CONFIGURATION_VERSION,
  DOCUMENT_REVIEW_WIDGET,
  INPUT_FORMAT_VERSION,
  LOCAL_API_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SETS,
  SESSION_FILE_FORMAT,
  SNAPSHOT_DATA_VERSION,
  TOOL_ENVELOPES_VERSION,
  VIEW_MANIFEST_VERSION,
  WIDGET_TYPES,
  widgetTypeOf,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { widgetItemProblems } from "../src/validate.ts";
import { unsupportedVersion } from "../src/versions.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
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

describe("the versions of the four widened sets", () => {
  test("each is one minor past main's, which holds input 1.12, output 1.11, envelopes 1.12 and board document 1.11 since the Table", () => {
    // Labels until task 8.2 binds them; a later change takes the next minor again, and moves these pins.
    expect({
      input: INPUT_FORMAT_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
    }).toEqual({ input: "1.13", output: "1.12", envelopes: "1.13", document: "1.12" });
  });

  test("every other set equals main's", () => {
    expect({
      protocol: BOARD_PROTOCOL_VERSION,
      snapshot: SNAPSHOT_DATA_VERSION,
      manifest: VIEW_MANIFEST_VERSION,
      configuration: CONFIGURATION_VERSION,
      localApi: LOCAL_API_VERSION,
      sessionFile: SESSION_FILE_FORMAT,
    }).toEqual({
      protocol: "1.8",
      snapshot: "1.1",
      manifest: "1.1",
      configuration: "1.0",
      localApi: "1.0",
      sessionFile: "1.0",
    });
  });

  test("the sets hold those constants", () => {
    expect(setOf("input").version).toBe(INPUT_FORMAT_VERSION);
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
    expect(setOf("tool-envelopes").version).toBe(TOOL_ENVELOPES_VERSION);
    expect(setOf("board-document").version).toBe(BOARD_DOCUMENT_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    for (const [name, previous] of [
      ["input", "1.12"],
      ["tool-envelopes", "1.12"],
      ["board-document", "1.11"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous), name).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0"), name).toBeDefined();
    }
  });

  test("the three modules' headers name this change", async () => {
    for (const module of ["input", "tool-envelopes", "board-document"]) {
      const text = await Bun.file(
        new URL(`../src/schemas/${module}/index.ts`, import.meta.url),
      ).text();
      expect(text.split("\nimport ")[0] as string, module).toContain("document-review");
    }
  });
});

describe("the Document review in the composed schemas", () => {
  test("the registry holds it right after the Table, last, which follows the PickField", () => {
    const types = WIDGET_TYPES.map(({ type }) => type);
    expect(types.indexOf("document-review")).toBe(types.indexOf("table") + 1);
    expect(types.indexOf("table")).toBe(types.indexOf("pick-field") + 1);
    expect(types.at(-1)).toBe("document-review");
    expect(WIDGET_TYPES).toContain(DOCUMENT_REVIEW_WIDGET);
    expect(widgetTypeOf("document-review")).toBe(DOCUMENT_REVIEW_WIDGET);
  });

  test("a question's items take its item after the Table's, before the molecule reference", () => {
    const refs = refsOf(schemaOf("input", "urn:askboard:input:question-props"), "item");
    expect(refs.at(-1)).toBe("molecule");
    expect(refs.indexOf("document-review")).toBe(refs.indexOf("table") + 1);
    expect(schemaOf("input", "urn:askboard:input:document-review-props").additionalProperties).toBe(
      false,
    );
  });

  test("the board document and fetch's result hold its item", () => {
    const document = schemaOf("board-document", "urn:askboard:board-document:board-document");
    expect(refsOf(document, "contextItem")).toContain("document-review");
    const fetchResult = schemaOf("tool-envelopes", "urn:askboard:tool-envelopes:fetch-result");
    expect(refsOf(fetchResult, "contextItem")).toContain("document-review");
    expect(fetchResult.$defs.item.properties.type.enum).toContain("document-review");
  });

  test("the output set lists its result schema, and the input set its props", () => {
    const ids = (set: string) => (setOf(set).schemas as AnySchemaObject[]).map(({ $id }) => $id);
    expect(ids("output")).toContain("urn:askboard:output:document-review-result");
    expect(ids("input")).toContain("urn:askboard:input:document-review-props");
  });
});

// The previous minor holds every type but the Document review: an ask holding one fails there,
// naming the item and its type; over the shipped registry it passes.
const PREVIOUS_MINOR = WIDGET_TYPES.filter((entry) => entry !== DOCUMENT_REVIEW_WIDGET);

describe("the previous minor refuses the Document review", () => {
  const { item } = DOCUMENT_REVIEW_WIDGET.example;

  test("an ask holding one fails over the registry without it, naming the item and its type", () => {
    expect(PREVIOUS_MINOR).toHaveLength(WIDGET_TYPES.length - 1);
    expect(askAccepted(PREVIOUS_MINOR, item)).toBe(false);
    expect(widgetItemProblems(item, question(item), "agent", PREVIOUS_MINOR)).toEqual([
      {
        path: "/",
        message: `item ${item.id} has the type "document-review", which is no widget the contract defines`,
      },
    ]);
  });

  test("the same ask passes over the shipped registry", () => {
    expect(askAccepted(WIDGET_TYPES, item)).toBe(true);
    expect(widgetItemProblems(item, question(item), "agent", WIDGET_TYPES)).toEqual([]);
  });
});

describe("a fetch of a Document review alone, over the shipped sets", () => {
  const ajv = ajvOver(WIDGET_TYPES);
  const item = (documentReviewFetchItemResult as { item: object }).item;

  test("validates with its annotations", () => {
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, documentReviewFetchItemResult)).toEqual([]);
  });

  test("fails with a Chart's result, at the item's result", () => {
    const errors = errorsOf(ajv, SCHEMA_IDS.fetchResult, {
      ...documentReviewFetchItemResult,
      item: { ...item, result: { points: [{ series: "a", category: "b" }] } },
    });
    expect(errors.map((error) => error.instancePath)).toContain("/item/result");
  });
});
