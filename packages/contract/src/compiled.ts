// The one Ajv instance that holds every schema of every set (AD-7, Stack). The schemas compile once,
// at the first validation (design decision 2).

import Ajv2020, { type ErrorObject, type Options } from "ajv/dist/2020";
import { SCHEMA_SETS } from "./sets.ts";

/**
 * The options every contract Ajv instance takes: strict mode, every error, and `discriminator`,
 * with which a list of items or acts picks each element's schema by its `type` (or an update's
 * actions by `action`) and reports only that schema's errors.
 */
export const AJV_OPTIONS = { strict: true, allErrors: true, discriminator: true } as const;

/** An Ajv instance in strict mode holding every schema of every set, compiled on first use. */
export const createAjv = (options: Options = {}): Ajv2020 => {
  const ajv = new Ajv2020({ ...AJV_OPTIONS, ...options });
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

/**
 * The errors of one contract schema on a value, by the schema's `$id`; empty when it passes. An
 * `if` error is left out: it only says that the branch it chose failed, whose own errors say why.
 */
export const schemaErrors = (id: string, value: unknown): readonly ErrorObject[] => {
  const validate = compiled().getSchema(id);
  if (validate === undefined) throw new Error(`the contract has no schema ${id}`);
  if (validate(value)) return [];
  return (validate.errors ?? []).filter((error) => error.keyword !== "if");
};
