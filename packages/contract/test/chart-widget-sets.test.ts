// The four sets chart-widget widens (contract spec, "The Chart in the sets' next minors"; design
// decision 11): the input format, the output format, the tool envelopes and the board document each
// take one minor past main's when the Chart joins the registry; every other set keeps main's. The
// numbers are those bound while the change is built, here and in the constants only: the rebase
// task rebinds them.

import { describe, expect, test } from "bun:test";
import type { AnySchemaObject } from "ajv/dist/2020";
import { chartFetchItemResult } from "../src/fixtures/index.ts";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  CHART_WIDGET,
  CONFIGURATION_VERSION,
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
  test("each is one minor past main's", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
    }).toEqual({ input: "1.8", output: "1.8", envelopes: "1.8", document: "1.7" });
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
      protocol: "1.6",
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
      ["input", "1.7"],
      ["output", "1.7"],
      ["tool-envelopes", "1.7"],
      ["board-document", "1.6"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous)).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0")).toBeDefined();
    }
  });
});

describe("the Chart in the composed schemas", () => {
  test("the registry ends with the Chart, after the Ranking", () => {
    expect(WIDGET_TYPES.at(-1)).toBe(CHART_WIDGET);
    expect(WIDGET_TYPES.map(({ type }) => type).slice(-2)).toEqual(["ranking", "chart"]);
    expect(widgetTypeOf("chart")).toBe(CHART_WIDGET);
  });

  test("a question's items take the Chart's item last but for the molecule reference", () => {
    const refs = refsOf(schemaOf("input", "urn:askboard:input:question-props"), "item");
    expect(refs.at(-1)).toBe("molecule");
    expect(refs.at(-2)).toBe("chart");
    expect(schemaOf("input", "urn:askboard:input:chart-props").additionalProperties).toBe(false);
  });

  test("the board document and fetch's result hold its item", () => {
    const document = schemaOf("board-document", "urn:askboard:board-document:board-document");
    expect(refsOf(document, "contextItem").at(-1)).toBe("chart");
    const fetchResult = schemaOf("tool-envelopes", "urn:askboard:tool-envelopes:fetch-result");
    expect(refsOf(fetchResult, "contextItem")).toContain("chart");
    expect(fetchResult.$defs.item.properties.type.enum).toContain("chart");
  });

  test("the output set lists its result schema, and the input set its props", () => {
    const ids = (set: string) => (setOf(set).schemas as AnySchemaObject[]).map(({ $id }) => $id);
    expect(ids("output")).toContain("urn:askboard:output:chart-result");
    expect(ids("input")).toContain("urn:askboard:input:chart-props");
  });
});

// The previous minor holds every type but the Chart (contract spec, "The previous minor"): an ask
// holding a Chart fails there, naming the item and its type; over the shipped registry it passes.
const PREVIOUS_MINOR = WIDGET_TYPES.filter((entry) => entry !== CHART_WIDGET);

describe("the previous minor refuses the Chart", () => {
  const { item } = CHART_WIDGET.example;

  test("an ask holding a Chart fails over the registry without it, naming the item and its type", () => {
    expect(PREVIOUS_MINOR).toHaveLength(WIDGET_TYPES.length - 1);
    expect(askAccepted(PREVIOUS_MINOR, item)).toBe(false);
    expect(widgetItemProblems(item, question(item), "agent", PREVIOUS_MINOR)).toEqual([
      {
        path: "/",
        message: `item ${item.id} has the type "chart", which is no widget the contract defines`,
      },
    ]);
  });

  test("the same ask passes over the shipped registry", () => {
    expect(askAccepted(WIDGET_TYPES, item)).toBe(true);
    expect(widgetItemProblems(item, question(item), "agent", WIDGET_TYPES)).toEqual([]);
  });
});

describe("a fetch of a Chart alone, over the shipped sets", () => {
  const ajv = ajvOver(WIDGET_TYPES);
  const item = (chartFetchItemResult as { item: object }).item;

  test("validates with its points", () => {
    expect(errorsOf(ajv, SCHEMA_IDS.fetchResult, chartFetchItemResult)).toEqual([]);
  });

  test("fails with a Scale's result, at the item's result", () => {
    const errors = errorsOf(ajv, SCHEMA_IDS.fetchResult, {
      ...chartFetchItemResult,
      item: { ...item, result: { value: 3 } },
    });
    expect(errors.map((error) => error.instancePath)).toContain("/item/result");
  });
});
