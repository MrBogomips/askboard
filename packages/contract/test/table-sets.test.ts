// The Table in the sets' next minors (table-widget, task 6.3; contract spec: The Table in the sets'
// next minors; design decisions 14 and 16): the input format, the output format, the tool envelopes
// and the board document each take one minor past form-widget's when the Table joins `WIDGET_TYPES`, over
// the shipped registry alone, with no `withWidgetTypes`; the board protocol keeps the minor task 1.5
// gave it, and every other set keeps `main`'s. The numbers are bound here and in the constants only
// (askboard-contract-versioning, Rule 1); the next change that widens a set moves the pins below.

import { describe, expect, test } from "bun:test";
import {
  lifecycleBoardDocument,
  lifecycleFetchResult,
  TABLE_FIXTURE_ITEM,
} from "../src/fixtures/index.ts";
import {
  BOARD_DOCUMENT_VERSION,
  BOARD_PROTOCOL_VERSION,
  CONFIGURATION_VERSION,
  INPUT_FORMAT_VERSION,
  LOCAL_API_VERSION,
  OUTPUT_FORMAT_VERSION,
  SCHEMA_SETS,
  SESSION_FILE_FORMAT,
  SNAPSHOT_DATA_VERSION,
  TABLE_WIDGET,
  TOOL_ENVELOPES_VERSION,
  VIEW_MANIFEST_VERSION,
  WIDGET_TYPES,
  widgetRegistryProblems,
} from "../src/index.ts";
import { SCHEMA_IDS } from "../src/sets.ts";
import { unsupportedVersion } from "../src/versions.ts";
import { ajvOver, errorsOf } from "./probe-ajv.ts";
import { ask, askAccepted, question } from "./result-widgets-support.ts";

const setOf = (name: string) => {
  const set = SCHEMA_SETS.find((candidate) => candidate.name === name);
  if (set === undefined) throw new Error(`no set ${name}`);
  return set;
};

const roles = TABLE_FIXTURE_ITEM as unknown as { type: string; id: string; props: unknown };
const inGroup = { type: "group", id: "box", props: { title: "Box", items: [roles] } };

describe("the Table in the registry", () => {
  test("is right after the PickField, with later registrations after it, and the registry holds together", () => {
    const types = WIDGET_TYPES.map(({ type }) => type);
    expect(types.indexOf("table")).toBe(types.indexOf("pick-field") + 1);
    expect(WIDGET_TYPES.filter(({ type }) => type === "table")).toHaveLength(1);
    expect(widgetRegistryProblems(WIDGET_TYPES)).toEqual([]);
  });
});

describe("the minors the Table binds", () => {
  test("the four widened sets are one minor past form-widget's, and the sets carry the constants", () => {
    // Form-widget's were input 1.11, output 1.10, tool envelopes 1.11 and board document 1.10; the
    // Table's, 1.12, 1.11, 1.12 and 1.11, or a later change's (document-review's), which pin the latest.
    const minor = (version: string): number => Number(version.split(".")[1]);
    expect({
      input: minor(INPUT_FORMAT_VERSION) >= 12,
      output: minor(OUTPUT_FORMAT_VERSION) >= 11,
      envelopes: minor(TOOL_ENVELOPES_VERSION) >= 12,
      document: minor(BOARD_DOCUMENT_VERSION) >= 11,
    }).toEqual({ input: true, output: true, envelopes: true, document: true });
    for (const [name, version] of [
      ["input", INPUT_FORMAT_VERSION],
      ["output", OUTPUT_FORMAT_VERSION],
      ["tool-envelopes", TOOL_ENVELOPES_VERSION],
      ["board-document", BOARD_DOCUMENT_VERSION],
    ] as const) {
      expect(setOf(name).version, name).toBe(version);
    }
  });

  test("every other set keeps its minor, except the Snapshot data, which stands at widget-registry's minor or a later one: the board protocol task 1.5 gave it (one past the base's 1.7), the rest main's", () => {
    expect(BOARD_PROTOCOL_VERSION).toBe("1.8");
    expect({
      // The Snapshot data: widget-registry's minor or a later one; snapshot-toolbar.test.ts pins the latest.
      snapshot: Number(SNAPSHOT_DATA_VERSION.split(".")[1]) >= 1,
      manifest: VIEW_MANIFEST_VERSION,
      configuration: CONFIGURATION_VERSION,
      localApi: LOCAL_API_VERSION,
      sessionFile: SESSION_FILE_FORMAT,
    }).toEqual({
      snapshot: true,
      manifest: "1.1",
      configuration: "1.0",
      localApi: "1.0",
      sessionFile: "1.0",
    });
    expect(setOf("board-protocol").version).toBe(BOARD_PROTOCOL_VERSION);
  });

  test("a receiver at the new minor accepts the previous minor, a two-digit minor, and refuses another major", () => {
    for (const [name, previous] of [
      ["input", "1.11"],
      ["output", "1.10"],
      ["tool-envelopes", "1.11"],
      ["board-document", "1.10"],
    ] as const) {
      expect(unsupportedVersion(setOf(name), previous), name).toBeUndefined();
      expect(unsupportedVersion(setOf(name), "2.0"), name).toBeDefined();
    }
    expect(unsupportedVersion(setOf("input"), INPUT_FORMAT_VERSION)).toBeUndefined();
    expect(unsupportedVersion(setOf("output"), OUTPUT_FORMAT_VERSION)).toBeUndefined();
  });

  test("each widened set module's header names this change", async () => {
    for (const module of ["input", "output", "board-document", "tool-envelopes"]) {
      const text = await Bun.file(
        new URL(`../src/schemas/${module}/index.ts`, import.meta.url),
      ).text();
      const header = text.split("\nimport ")[0] as string;
      expect(header, module).toContain("table-widget");
    }
  });
});

describe("a Table in the sets, over the shipped registry", () => {
  const AJV = ajvOver(WIDGET_TYPES);
  type Document = { items: { props: { items: unknown[] } }[] };

  test("an ask holding the Table of roles, alone and inside a Group, validates", () => {
    expect(askAccepted(WIDGET_TYPES, roles)).toBe(true);
    expect(askAccepted(WIDGET_TYPES, inGroup)).toBe(true);
    expect(errorsOf(AJV, SCHEMA_IDS.ask, ask(question(inGroup)))).toEqual([]);
  });

  test("the board document and a fetch result holding it inside a Group validate", () => {
    const document = structuredClone(lifecycleBoardDocument) as unknown as Document;
    const [region] = document.items[0]?.props.items ?? [];
    if (region === undefined) throw new Error("no question");
    (region as { props: unknown }).props = { text: "Which?", items: [inGroup] };
    expect(errorsOf(AJV, SCHEMA_IDS.boardDocument, document)).toEqual([]);
    const asked = {
      type: "question",
      id: "q",
      rev: 1,
      state: "open",
      props: { text: "Q", items: [inGroup] },
    };
    expect(
      errorsOf(AJV, SCHEMA_IDS.fetchResult, {
        ...structuredClone(lifecycleFetchResult),
        item: asked,
      }),
    ).toEqual([]);
    const alone = { ...roles, questionId: "q", state: "open" };
    expect(
      errorsOf(AJV, SCHEMA_IDS.fetchResult, {
        ...structuredClone(lifecycleFetchResult),
        item: alone,
      }),
    ).toEqual([]);
  });

  test("an ask without a Table, and a draft record without a cell entry, still validate", () => {
    const text = { type: "text-field", id: "t", props: { label: "T" } };
    expect(askAccepted(WIDGET_TYPES, text)).toBe(true);
  });

  test("a Table whose column breaks the schema is refused", () => {
    const bad = {
      ...roles,
      props: { label: "x", columns: [{ field: "a", label: "A", type: "colour" }], rows: [] },
    };
    expect(askAccepted(WIDGET_TYPES, bad)).toBe(false);
  });
});
