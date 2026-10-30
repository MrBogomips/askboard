// The one Ajv instance that holds every schema of every set (AD-7, Stack). The schemas compile once,
// at the first validation (design decision 2).

import Ajv2020, { type ErrorObject, type Options } from "ajv/dist/2020";
import { SCHEMA_SETS } from "./sets.ts";

/** An Ajv instance in strict mode holding every schema of every set, compiled on first use. */
export const createAjv = (options: Options = {}): Ajv2020 => {
  const ajv = new Ajv2020({ strict: true, allErrors: true, ...options });
  for (const set of SCHEMA_SETS) {
    for (const schema of set.schemas) ajv.addSchema(schema);
  }
  return ajv;
};

let shared: Ajv2020 | undefined;

/** The shared instance, created at the first validation. */
export const compiled = (): Ajv2020 => {
  shared ??= createAjv();
  return shared;
};

/** The errors of one contract schema on a value, by the schema's `$id`; empty when it passes. */
export const schemaErrors = (id: string, value: unknown): readonly ErrorObject[] => {
  const validate = compiled().getSchema(id);
  if (validate === undefined) throw new Error(`the contract has no schema ${id}`);
  return validate(value) ? [] : (validate.errors ?? []);
};
