// The registry's own check (widget-registry, contract spec, "The widget-type registry"): the
// shape rules of `registry.ts` and the one rule that needs a validator, which the registry module
// may not import (its import rule): a result schema must refuse a result that holds nothing the
// user gave (NFR-10, AD-10; core refuses such a result too, whatever the schema says).

import type { AnySchemaObject } from "ajv/dist/2020";
import { createAjv } from "../validate.ts";
import { type RegistryProblem, registryShapeProblems, type WidgetType } from "./registry.ts";

// The values a result schema must refuse, as the problem shows them.
const EMPTY_RESULTS: readonly (readonly [string, unknown])[] = [
  ["null", null],
  ["{}", {}],
  ["[]", []],
  ['""', ""],
];

// The empty values `schema` accepts. Compiled in an Ajv of its own, so that a schema under test
// never reaches the one the widget validators share.
const emptyValuesAccepted = (schema: AnySchemaObject): readonly string[] => {
  const ajv = createAjv();
  ajv.addSchema(schema);
  const validate = ajv.getSchema(schema.$id as string);
  if (validate === undefined) throw new Error("the schema has no $id");
  return EMPTY_RESULTS.filter(([, value]) => validate(value)).map(([shown]) => shown);
};

const resultProblem = (entry: WidgetType, index: number): RegistryProblem | undefined => {
  const schema = entry.result?.schema;
  if (schema === undefined) return undefined;
  const type = typeof entry.type === "string" ? entry.type : `entry ${index}`;
  const problem = (message: string): RegistryProblem => ({ type, rule: "result-empty", message });
  try {
    const accepted = emptyValuesAccepted(schema);
    return accepted.length === 0
      ? undefined
      : problem(
          `the result schema of "${type}" accepts ${accepted.join(", ")}, a result that holds nothing the user gave`,
        );
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return problem(`the result schema of "${type}" does not compile: ${why}`);
  }
};

/**
 * What is wrong with a registry as a whole: the shape rules of `registryShapeProblems`, then each
 * result schema that accepts `null`, `{}`, `[]` or `""` (rule `result-empty`), found by validating
 * those four against it. Empty when it holds together.
 */
export const widgetRegistryProblems = (
  types: readonly WidgetType[],
): readonly RegistryProblem[] => [
  ...registryShapeProblems(types),
  ...types.flatMap((entry, index) => resultProblem(entry, index) ?? []),
];
