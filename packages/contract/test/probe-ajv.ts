// A fresh Ajv holding every schema set of the contract with the three schemas the registry
// composes made over `types`, and the schemas the types carry that no set holds (the test-only
// type's), as a later widget change's tests need it. Not a test file.

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

export const ajvOver = (types: readonly WidgetType[]): Ajv2020 => {
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
