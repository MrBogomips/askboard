// An Ajv over a registry the shipped sets do not hold (layouts, design decision 3): every schema
// set of the contract with the three schemas the registry composes made over `types`, and the
// schemas of the types themselves that no set lists. The layouts' props refer to the union of
// items composed from the registry (`layoutItem`), which only a registry that holds a layout has,
// so a test that checks a layout before it is registered validates it here. Nothing happens at
// import; one instance is kept, for the registry last asked for.

import Ajv2020, { type AnySchemaObject } from "ajv/dist/2020";
import { AJV_OPTIONS } from "../compiled.ts";
import boardDocumentBase from "../schemas/board-document/board-document.json" with { type: "json" };
import questionPropsBase from "../schemas/input/question-props.json" with { type: "json" };
import fetchResultBase from "../schemas/tool-envelopes/fetch-result.json" with { type: "json" };
import { SCHEMA_IDS, SCHEMA_SETS } from "../sets.ts";
import { composeBoardDocument, composeFetchResult, composeQuestionProps } from "./compose.ts";
import type { WidgetType } from "./registry.ts";

let kept: { readonly types: readonly WidgetType[]; readonly ajv: Ajv2020 } | undefined;

const build = (types: readonly WidgetType[]): Ajv2020 => {
  const composed: Record<string, AnySchemaObject> = {
    [SCHEMA_IDS.questionProps]: composeQuestionProps(questionPropsBase, types),
    [SCHEMA_IDS.boardDocument]: composeBoardDocument(boardDocumentBase, types),
    [SCHEMA_IDS.fetchResult]: composeFetchResult(fetchResultBase, types),
  };
  const ajv = new Ajv2020({ ...AJV_OPTIONS });
  const held = new Set<string>();
  for (const set of SCHEMA_SETS) {
    for (const schema of set.schemas as AnySchemaObject[]) {
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

/** The Ajv over `types`, made on first use and kept while the same registry is asked for. */
export const registryAjv = (types: readonly WidgetType[]): Ajv2020 => {
  if (kept?.types.length === types.length && kept.types.every((each, at) => each === types[at])) {
    return kept.ajv;
  }
  const ajv = build(types);
  kept = { types, ajv };
  return ajv;
};

/**
 * The input format's question props composed over `types`: with a layout among them, the union
 * the layouts' props hold. The generated skill resolves a layout's references through it.
 */
export const questionPropsOver = (types: readonly WidgetType[]): AnySchemaObject =>
  composeQuestionProps(questionPropsBase, types);
