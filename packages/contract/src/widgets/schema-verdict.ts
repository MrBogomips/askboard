// A value through one widget schema (widget-registry): by `$id` where a schema set holds the schema
// (Tree and Gantt props, a result schema the output format lists), else through the widget
// validator, which adds a schema no set holds (a test type's) to its own Ajv on first use. The
// problems read the same either way. Nothing happens at import.

import type Ajv2020 from "ajv/dist/2020";
import type { AnySchemaObject } from "ajv/dist/2020";
import { compiled } from "../compiled.ts";
import { type Checked, validateAgainst } from "../validate.ts";
import { widgetValidator } from "./validator.ts";

// The validator of a schema no set holds, made on first use and kept.
const validators = new WeakMap<object, (value: unknown) => Checked<unknown>>();

/** `value` against `schema`, a schema with an `$id`. */
export const schemaVerdict = (schema: AnySchemaObject, value: unknown): Checked<unknown> => {
  const ajv: Ajv2020 = compiled();
  if (ajv.getSchema(schema.$id as string) !== undefined) {
    return validateAgainst(schema.$id as string, value);
  }
  let validate = validators.get(schema);
  if (validate === undefined) {
    validate = widgetValidator([schema], schema.$id as string);
    validators.set(schema, validate);
  }
  return validate(value);
};
