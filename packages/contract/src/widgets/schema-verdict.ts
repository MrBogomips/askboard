// A value through one widget schema (widget-registry): by `$id` where a schema set holds the schema
// (Tree and Gantt props, a result schema the output format lists), else through the widget
// validator, which adds a schema no set holds (a test type's) to its own Ajv on first use. The
// problems read the same either way. Nothing happens at import.

import type Ajv2020 from "ajv/dist/2020";
import type { AnySchemaObject } from "ajv/dist/2020";
import { compiled } from "../compiled.ts";
import { isLayoutType } from "../nested-items.ts";
import { type Checked, problemOf, validateAgainst } from "../validate.ts";
import { WIDGET_TYPES, type WidgetType } from "./registry.ts";
import { registryAjv } from "./registry-ajv.ts";
import { widgetValidator } from "./validator.ts";

// The validator of a schema no set holds, made on first use and kept.
const validators = new WeakMap<object, (value: unknown) => Checked<unknown>>();

// A registry that holds a layout the shipped sets do not (the Tabs, before it is registered): its props refer to the union composed
// over that registry, so it is checked in an Ajv made over it.
const overRegistry = (schema: AnySchemaObject, value: unknown, types: readonly WidgetType[]) => {
  const ajv = registryAjv(types);
  const validate = ajv.getSchema(schema.$id as string);
  if (validate === undefined) throw new Error(`no schema ${String(schema.$id)}`);
  if (validate(value)) return { ok: true, value } as const;
  return { ok: false, reason: "schema", problems: (validate.errors ?? []).map(problemOf) } as const;
};

/**
 * `value` against `schema`, a schema with an `$id`; `types` is the registry it belongs to, which
 * matters only to a layout that is not yet in the shipped sets.
 */
export const schemaVerdict = (
  schema: AnySchemaObject,
  value: unknown,
  types: readonly WidgetType[] = WIDGET_TYPES,
): Checked<unknown> => {
  const ajv: Ajv2020 = compiled();
  // A registry that holds a layout the shipped one does not: every schema is read over it, since
  // the shipped sets' union of items lacks that layout.
  if (types.some((entry) => isLayoutType(entry.type) && !WIDGET_TYPES.includes(entry))) {
    return overRegistry(schema, value, types);
  }
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
