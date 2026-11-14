// A fresh Ajv holding every schema set of the contract with the three schemas the registry
// composes made over `types`, and the schemas the types carry that no set holds (the test-only
// type's), as a later widget change's tests need it. Not a test file.
//
// The Ajv is built and its schemas compiled once for a registry (the same entries in the same
// order) and shared by everything that asks for it: a test file that calls `askAccepted` for each
// of fifty items used to build and compile one for each call. No test adds a schema to the Ajv it
// gets; one that needs to builds its own, as widget-compose.test.ts does.

import Ajv2020, { type AnySchemaObject } from "ajv/dist/2020";
import { AJV_OPTIONS } from "../src/compiled.ts";
import boardDocumentBase from "../src/schemas/board-document/board-document.json" with {
  type: "json",
};
import questionPropsBase from "../src/schemas/input/question-props.json" with { type: "json" };
import fetchResultBase from "../src/schemas/tool-envelopes/fetch-result.json" with { type: "json" };
import { SCHEMA_IDS, SCHEMA_SETS } from "../src/sets.ts";
import {
  composeBoardDocument,
  composeFetchResult,
  composeQuestionProps,
} from "../src/widgets/compose.ts";
import type { WidgetType } from "../src/widgets/registry.ts";

const schemasOf = (set: { readonly schemas: readonly object[] }): AnySchemaObject[] =>
  set.schemas as AnySchemaObject[];

const built = new Map<string, { readonly types: readonly WidgetType[]; readonly ajv: Ajv2020 }>();

export const ajvOver = (types: readonly WidgetType[]): Ajv2020 => {
  const key = types.map(({ type }) => type).join(",");
  const known = built.get(key);
  const same =
    known !== undefined &&
    known.types.length === types.length &&
    known.types.every((entry, at) => entry === types[at]);
  if (same) return known.ajv;
  const ajv = newAjvOver(types);
  built.set(key, { types: [...types], ajv });
  return ajv;
};

const newAjvOver = (types: readonly WidgetType[]): Ajv2020 => {
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

/** The errors of `value` against the schema `id` of `ajv`; none when it passes. */
export const errorsOf = (ajv: Ajv2020, id: string, value: unknown) => {
  const validate = ajv.getSchema(id);
  if (validate === undefined) throw new Error(`no schema ${id}`);
  return validate(value) ? [] : (validate.errors ?? []);
};
