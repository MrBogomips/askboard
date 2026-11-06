// The schemas composed from the registry (widget-registry, task 1.3; contract spec, "Schemas
// composed from the registry"): over the Tree and the Gantt they equal `main`'s three schemas, in
// order; over a registry that also holds the test-only type they accept its items and still refuse
// an unknown type at its type.

import { describe, expect, test } from "bun:test";
import Ajv2020, { type AnySchemaObject } from "ajv/dist/2020";
import { AJV_OPTIONS } from "../src/compiled.ts";
import { PROBE_TYPES, PROBE_WIDGET } from "../src/fixtures/index.ts";
import { BOARD_DOCUMENT_VERSION } from "../src/index.ts";
import boardDocumentBase from "../src/schemas/board-document/board-document.json" with {
  type: "json",
};
import questionPropsBase from "../src/schemas/input/question-props.json" with { type: "json" };
import fetchResultBase from "../src/schemas/tool-envelopes/fetch-result.json" with { type: "json" };
import { RESULT_VERSIONS } from "../src/schemas/tool-envelopes/index.ts";
import { SCHEMA_IDS, SCHEMA_SETS } from "../src/sets.ts";
import {
  composeBoardDocument,
  composeFetchResult,
  composeQuestionProps,
} from "../src/widgets/compose.ts";
import { GANTT_WIDGET } from "../src/widgets/gantt/widget.ts";
import { WIDGET_TYPES } from "../src/widgets/registry.ts";
import { TREE_WIDGET } from "../src/widgets/tree/widget.ts";
import goldenBoardDocument from "./registry-golden/board-document.json" with { type: "json" };
import goldenFetchResult from "./registry-golden/fetch-result.json" with { type: "json" };
import goldenQuestionProps from "./registry-golden/question-props.json" with { type: "json" };

// A set's schemas, each an object with an `$id`.
const schemasOf = (set: { readonly schemas: readonly object[] }): AnySchemaObject[] =>
  set.schemas as AnySchemaObject[];

const TREE_AND_GANTT = [TREE_WIDGET, GANTT_WIDGET];

const shipped = (id: string): AnySchemaObject => {
  const found = SCHEMA_SETS.flatMap(schemasOf).find((schema) => schema.$id === id);
  if (found === undefined) throw new Error(`no schema ${id}`);
  return found;
};

describe("the composition over the Tree and the Gantt", () => {
  test("deep-equals main's three schemas, in order", () => {
    expect(composeQuestionProps(questionPropsBase, TREE_AND_GANTT)).toEqual(goldenQuestionProps);
    expect(composeBoardDocument(boardDocumentBase, TREE_AND_GANTT)).toEqual(goldenBoardDocument);
    expect(composeFetchResult(fetchResultBase, TREE_AND_GANTT)).toEqual(goldenFetchResult);
  });

  test("keeps the order of the item unions: context, Tree, Gantt, then the molecule", () => {
    const refs = (schema: AnySchemaObject, union: string) =>
      schema.$defs[union].oneOf.map(({ $ref }: { $ref: string }) => $ref.split("/").at(-1));
    expect(refs(goldenQuestionProps, "item")).toEqual([
      "excerpt",
      "reference",
      "image",
      "tree",
      "gantt",
      "molecule",
    ]);
    expect(refs(composeQuestionProps(questionPropsBase, TREE_AND_GANTT), "item")).toEqual(
      refs(goldenQuestionProps, "item"),
    );
  });

  test("is what the schema sets hold", () => {
    expect(shipped(SCHEMA_IDS.questionProps)).toEqual(goldenQuestionProps);
    expect(shipped(SCHEMA_IDS.boardDocument)).toEqual(goldenBoardDocument);
    expect(shipped(SCHEMA_IDS.fetchResult)).toEqual(goldenFetchResult);
    expect(WIDGET_TYPES).toEqual(TREE_AND_GANTT);
  });

  test("changes nothing it reads", () => {
    const before = JSON.stringify([questionPropsBase, boardDocumentBase, fetchResultBase]);
    composeQuestionProps(questionPropsBase, PROBE_TYPES);
    composeBoardDocument(boardDocumentBase, PROBE_TYPES);
    composeFetchResult(fetchResultBase, PROBE_TYPES);
    expect(JSON.stringify([questionPropsBase, boardDocumentBase, fetchResultBase])).toBe(before);
  });

  test("lists each type's props and changes schemas in the input and output sets", () => {
    const ids = (name: string) =>
      schemasOf(SCHEMA_SETS.find((set) => set.name === name) ?? { schemas: [] }).map(
        ({ $id }) => $id,
      );
    for (const { props } of WIDGET_TYPES) expect(ids("input")).toContain(props.$id);
    for (const { edits } of WIDGET_TYPES) expect(ids("output")).toContain(edits?.changes.$id);
  });
});

// A fresh Ajv holding every set of the contract, three of its schemas composed over `types`, and
// the schemas the types carry that no set holds.
const ajvOver = (types: typeof PROBE_TYPES): Ajv2020 => {
  const composed: Record<string, AnySchemaObject> = {
    [SCHEMA_IDS.questionProps]: composeQuestionProps(questionPropsBase, types),
    [SCHEMA_IDS.boardDocument]: composeBoardDocument(boardDocumentBase, types),
    [SCHEMA_IDS.fetchResult]: composeFetchResult(fetchResultBase, types),
  };
  const ajv = new Ajv2020({ ...AJV_OPTIONS });
  const held = new Set<string>();
  for (const set of SCHEMA_SETS) {
    for (const schema of schemasOf(set)) {
      const replaced = composed[schema.$id as string] ?? schema;
      ajv.addSchema(replaced);
      held.add(replaced.$id as string);
    }
  }
  for (const { props, edits, result } of types) {
    for (const schema of [props, edits?.changes, result?.schema]) {
      if (schema !== undefined && !held.has(schema.$id as string)) ajv.addSchema(schema);
    }
  }
  return ajv;
};

const probeQuestion = (item: unknown) => ({
  type: "question",
  id: "q",
  props: { text: "Which one?", items: [item] },
});
const PROBE = PROBE_WIDGET.example.item;
const KANBAN = { type: "kanban", id: "board", props: { options: [] } };

describe("the composition over a registry that also holds the test-only type", () => {
  const ajv = ajvOver(PROBE_TYPES);
  const errorsOf = (id: string, value: unknown) => {
    const validate = ajv.getSchema(id);
    if (validate === undefined) throw new Error(`no schema ${id}`);
    return validate(value) ? [] : (validate.errors ?? []);
  };
  const fetched = (item: unknown) => ({
    versions: RESULT_VERSIONS,
    epoch: "ep01a",
    askId: "order-db-x7k2",
    state: "waiting",
    item,
  });
  const alone = { ...PROBE, questionId: "q", state: "open" };

  test("accepts an ask whose question holds a probe item", () => {
    const ask = { askId: "order-db-x7k2", items: [probeQuestion(PROBE)] };
    expect(errorsOf(SCHEMA_IDS.ask, ask)).toEqual([]);
  });

  test("accepts a board document whose question holds a probe item", () => {
    const document = {
      version: BOARD_DOCUMENT_VERSION,
      title: "Which one?",
      askId: "order-db-x7k2",
      items: [{ ...probeQuestion(PROBE), rev: 1 }],
    };
    expect(errorsOf(SCHEMA_IDS.boardDocument, document)).toEqual([]);
  });

  test("accepts a fetch result of a probe item alone, and a question holding one", () => {
    expect(errorsOf(SCHEMA_IDS.fetchResult, fetched(alone))).toEqual([]);
    const question = { ...probeQuestion(PROBE), rev: 1, state: "open" };
    expect(errorsOf(SCHEMA_IDS.fetchResult, fetched(question))).toEqual([]);
  });

  test("checks a probe item's props by the probe's schema", () => {
    const broken = { ...PROBE, props: { options: [] } };
    expect(errorsOf(SCHEMA_IDS.ask, { askId: "a", items: [probeQuestion(broken)] })).not.toEqual(
      [],
    );
    expect(
      errorsOf(SCHEMA_IDS.fetchResult, fetched({ ...alone, props: { options: [] } })),
    ).not.toEqual([]);
  });

  test("refuses an item of type kanban at its type in each of the three", () => {
    const at = (errors: readonly { instancePath: string }[]) => errors.map((e) => e.instancePath);
    const ask = errorsOf(SCHEMA_IDS.ask, { askId: "a", items: [probeQuestion(KANBAN)] });
    expect(at(ask)).toContain("/items/0/props/items/0");
    const document = {
      version: BOARD_DOCUMENT_VERSION,
      title: "Which one?",
      askId: "a",
      items: [{ ...probeQuestion(KANBAN), rev: 1 }],
    };
    expect(at(errorsOf(SCHEMA_IDS.boardDocument, document))).toContain("/items/0/props/items/0");
    expect(
      errorsOf(SCHEMA_IDS.fetchResult, fetched({ ...KANBAN, questionId: "q", state: "open" })),
    ).not.toEqual([]);
    const question = { ...probeQuestion(KANBAN), rev: 1, state: "open" };
    expect(errorsOf(SCHEMA_IDS.fetchResult, fetched(question))).not.toEqual([]);
  });

  test("refuses a probe item over the shipped schemas, which do not hold it", () => {
    const shippedAjv = ajvOver(WIDGET_TYPES);
    const validate = shippedAjv.getSchema(SCHEMA_IDS.ask);
    expect(validate?.({ askId: "a", items: [probeQuestion(PROBE)] })).toBe(false);
  });

  test("a registry of one type composes a fetch result too", () => {
    const one = ajvOver([PROBE_WIDGET]);
    const validate = one.getSchema(SCHEMA_IDS.fetchResult);
    expect(validate?.(fetched(alone))).toBe(true);
    expect(validate?.(fetched({ ...alone, props: { options: [] } }))).toBe(false);
  });
});
