// One standalone validator per widget schema (design decision 2), for every widget. A widget's
// schemas belong to no schema set until the input format widens, so `validateAgainst` does not
// know them. Nothing happens at import or when a validator is made, as the package's
// `"sideEffects": false` requires: on its first validation, a validator adds the schemas it was
// given, those not already there, to one widget Ajv made by `createAjv`, so that E1's schemas, the
// ID schema among them, resolve as `$ref` targets, and compiles its own. Problems read as E1's.
//
// `validate.ts` re-exports this module, which imports from it: the cycle is safe because neither
// module makes a call at its top level.

import type Ajv2020 from "ajv/dist/2020";
import type { AnySchemaObject } from "ajv/dist/2020";
import { type Checked, createAjv, problemOf } from "../validate.ts";

let widgetAjv: Ajv2020 | undefined;

const compile = (schemas: readonly AnySchemaObject[], id: string) => {
  widgetAjv ??= createAjv();
  for (const schema of schemas) {
    if (typeof schema.$id !== "string") throw new Error("a widget schema has no $id");
    if (widgetAjv.schemas[schema.$id] === undefined) widgetAjv.addSchema(schema);
  }
  const validate = widgetAjv.getSchema(id);
  if (validate === undefined) throw new Error(`the contract has no schema ${id}`);
  return validate;
};

/** Validates against the widget schema `id`, compiling it with `schemas` on its first call. */
export const widgetValidator = <T>(
  schemas: readonly AnySchemaObject[],
  id: string,
): ((value: unknown) => Checked<T>) => {
  let validate: ReturnType<typeof compile> | undefined;
  return (value) => {
    validate ??= compile(schemas, id);
    if (validate(value)) return { ok: true, value: value as T };
    // An `if` error beside others only says that the branch it chose failed, whose own errors say
    // why: left out, as the schema sets' validators leave it, so the problems read the same either
    // way. When it is all there is, it is kept, so a refused value is never errorless.
    const errors = validate.errors ?? [];
    const kept = errors.filter((error) => error.keyword !== "if");
    return {
      ok: false,
      reason: "schema",
      problems: (kept.length > 0 ? kept : errors).map(problemOf),
    };
  };
};
