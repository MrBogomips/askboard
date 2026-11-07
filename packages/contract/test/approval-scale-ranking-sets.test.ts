// The four sets approval-scale-ranking widens (contract spec, "Approval, Scale and Ranking in
// the sets' next minors"; design decision 11): the input format, the output format, the tool envelopes and the
// board document each take one minor past main's when the Approval joins the registry; the board
// protocol, the Snapshot data and the view manifest keep main's. The numbers are those bound at the
// rebase on main efe92afb (design decision 11), here and in the constants only.

import { describe, expect, test } from "bun:test";
import type { AnySchemaObject } from "ajv/dist/2020";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  INPUT_FORMAT_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SETS,
  SNAPSHOT_DATA_VERSION,
  TOOL_ENVELOPES_VERSION,
  VIEW_MANIFEST_VERSION,
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

describe("the versions of the four widened sets", () => {
  test("each is one minor past main's, and every other set equals main's", () => {
    expect({
      input: INPUT_FORMAT_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      envelopes: TOOL_ENVELOPES_VERSION,
      document: BOARD_DOCUMENT_VERSION,
    }).toEqual({ input: "1.7", output: "1.7", envelopes: "1.7", document: "1.6" });

    expect({
      protocol: BOARD_PROTOCOL_VERSION,
      snapshot: SNAPSHOT_DATA_VERSION,
      manifest: VIEW_MANIFEST_VERSION,
    }).toEqual({ protocol: "1.6", snapshot: "1.1", manifest: "1.1" });
  });

  test("the sets hold those constants", () => {
    expect(setOf("input").version).toBe(INPUT_FORMAT_VERSION);
    expect(setOf("output").version).toBe(OUTPUT_FORMAT_VERSION);
    expect(setOf("tool-envelopes").version).toBe(TOOL_ENVELOPES_VERSION);
    expect(setOf("board-document").version).toBe(BOARD_DOCUMENT_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor and refuses another major", () => {
    for (const [name, previous] of [
      ["input", "1.5"],
      ["output", "1.5"],
      ["tool-envelopes", "1.5"],
      ["board-document", "1.4"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous)).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0")).toBeDefined();
    }
  });
});

describe("the Approval in the composed schemas", () => {
  test("the registry lists the Approval after the Tree and the Gantt", () => {
    expect(WIDGET_TYPES.map(({ type }) => type).slice(0, 3)).toEqual(["tree", "gantt", "approval"]);
  });

  test("a question's items take its item after the Gantt's and before the molecule reference", () => {
    const refs = refsOf(schemaOf("input", "urn:askboard:input:question-props"), "item");
    expect(refs.slice(0, 6)).toEqual([
      "excerpt",
      "reference",
      "image",
      "tree",
      "gantt",
      "approval",
    ]);
    expect(refs.at(-1)).toBe("molecule");
    expect(schemaOf("input", "urn:askboard:input:approval-props").additionalProperties).toBe(false);
  });

  test("the board document and fetch's result hold its item", () => {
    const document = schemaOf("board-document", "urn:askboard:board-document:board-document");
    const documentRefs = refsOf(document, "contextItem");
    expect(documentRefs.indexOf("approval")).toBeGreaterThan(documentRefs.indexOf("gantt"));
    const fetchResult = schemaOf("tool-envelopes", "urn:askboard:tool-envelopes:fetch-result");
    expect(refsOf(fetchResult, "contextItem")).toContain("approval");
    expect(fetchResult.$defs.item.properties.type.enum).toContain("approval");
  });

  test("the output set lists its result schema", () => {
    const ids = (setOf("output").schemas as AnySchemaObject[]).map(({ $id }) => $id);
    expect(ids).toContain("urn:askboard:output:approval-result");
  });
});

// The previous minor holds the Tree and the Gantt and none of the three types (contract spec,
// "The previous minor"): an ask holding one of them fails there, naming the item and its type.
const PREVIOUS_MINOR = [TREE_WIDGET, GANTT_WIDGET];
const THE_THREE = [APPROVAL_WIDGET, SCALE_WIDGET, RANKING_WIDGET];

describe("the previous minor refuses the three types", () => {
  test.each(THE_THREE.map((entry) => [entry.type, entry] as const))(
    "an ask holding a %s item fails over the Tree and the Gantt, naming the item and its type",
    (type, entry) => {
      const { item } = entry.example;
      expect(item.type).toBe(type);
      expect(askAccepted(PREVIOUS_MINOR, item)).toBe(false);
      expect(widgetItemProblems(item, question(item), "agent", PREVIOUS_MINOR)).toEqual([
        {
          path: "/",
          message: `item ${item.id} has the type "${type}", which is no widget the contract defines`,
        },
      ]);
    },
  );

  test.each(THE_THREE.map((entry) => [entry.type, entry] as const))(
    "the same %s ask passes over the shipped registry",
    (_type, entry) => {
      const { item } = entry.example;
      expect(askAccepted(WIDGET_TYPES, item)).toBe(true);
      expect(widgetItemProblems(item, question(item), "agent", WIDGET_TYPES)).toEqual([]);
    },
  );
});

describe("the three types' schema descriptions", () => {
  test("none says it is in no schema set, since each is in its set", () => {
    for (const { type, props, result } of THE_THREE) {
      const schemas = [props, result?.schema].filter((schema) => schema !== undefined);
      expect(schemas.length).toBeGreaterThan(0);
      for (const schema of schemas) {
        expect({ type, id: schema.$id, text: schema.description }).toEqual({
          type,
          id: schema.$id,
          text: expect.not.stringContaining("In no schema set"),
        });
      }
    }
  });

  test("each ends by naming the format that holds it since approval-scale-ranking", () => {
    for (const { props, result } of THE_THREE) {
      expect(props.description).toEndWith("In the input format since approval-scale-ranking.");
      expect(result?.schema.description).toEndWith(
        "In the output format since approval-scale-ranking.",
      );
    }
  });
});
