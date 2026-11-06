// The schemas composed from the registry (widget-registry, design decision 4): three JSON files
// keep their non-widget parts, and these pure functions add, per registered type, its item in the
// question items of the input format, in the board document's and in `fetch`'s, and fold `fetch`'s
// widget-item branch over the types. Composed over the Tree and the Gantt they equal the schemas
// before the registry, in order (`test/registry-golden/`). Each takes the registry as its last
// parameter, defaulting to the shipped one, and returns a new schema: the JSON it reads is never
// changed. Nothing here compiles a schema; the set modules call them when they load.

import type { AnySchemaObject } from "ajv/dist/2020";
import { WIDGET_TYPES, type WidgetType } from "./registry.ts";

const ID = { $ref: "urn:askboard:input:id" } as const;

// A widget item `{type, id, props}`, its props the type's schema.
const itemOf = (entry: WidgetType, description?: string): AnySchemaObject => ({
  ...(description === undefined ? {} : { description }),
  type: "object",
  properties: {
    type: { const: entry.type },
    id: ID,
    props: { $ref: entry.props.$id },
  },
  required: ["type", "id", "props"],
  additionalProperties: false,
});

const refTo = (type: string) => ({ $ref: `#/$defs/${type}` });

// `schema` with the types' items added to `$defs` and `oneOf` of the union `union`, at the end of
// its list or, with `before`, before that definition's reference.
const withItems = (
  schema: AnySchemaObject,
  union: string,
  types: readonly WidgetType[],
  describe: (entry: WidgetType) => string | undefined,
  before?: string,
): AnySchemaObject => {
  const defs: AnySchemaObject = { ...schema.$defs };
  for (const entry of types) defs[entry.type] = itemOf(entry, describe(entry));
  const refs: unknown[] = [...schema.$defs[union].oneOf];
  const at =
    before === undefined
      ? refs.length
      : refs.findIndex((ref) => (ref as { $ref: string }).$ref === `#/$defs/${before}`);
  refs.splice(at, 0, ...types.map(({ type }) => refTo(type)));
  defs[union] = { ...defs[union], oneOf: refs };
  return { ...schema, $defs: defs };
};

/** The input format's question props: each type's item before the molecule reference's. */
export const composeQuestionProps = (
  base: AnySchemaObject,
  types: readonly WidgetType[] = WIDGET_TYPES,
): AnySchemaObject => withItems(base, "item", types, () => undefined, "molecule");

/** The board document: each type's item after the resolved context items. */
export const composeBoardDocument = (
  base: AnySchemaObject,
  types: readonly WidgetType[] = WIDGET_TYPES,
): AnySchemaObject => withItems(base, "contextItem", types, () => undefined);

const capitalised = (noun: string): string => `${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;

// The keyword of a JSON Schema conditional's branch. Biome flags an object literal with a `then`
// key as a thenable, which a schema needs; a name held in a constant is no such literal.
const THEN = "then";

// A JSON Schema conditional.
const conditional = (
  condition: AnySchemaObject,
  whenTrue: AnySchemaObject,
  otherwise?: AnySchemaObject,
): AnySchemaObject =>
  otherwise === undefined
    ? { if: condition, [THEN]: whenTrue }
    : { if: condition, [THEN]: whenTrue, else: otherwise };

// A widget item's props by its type, in registry order: each type before the last is an `if`, the
// last takes the `else`; a registry of one type has its `if` alone. Never a `properties` at the
// top, which would replace the branch's own.
const propsBranch = (types: readonly WidgetType[]): AnySchemaObject => {
  const ifType = (entry: WidgetType) => ({ properties: { type: { const: entry.type } } });
  const props = (entry: WidgetType) => ({ properties: { props: { $ref: entry.props.$id } } });
  const [first, ...rest] = types as readonly [WidgetType, ...WidgetType[]];
  if (rest.length === 0) return conditional(ifType(first), props(first));
  const last = rest.pop() as WidgetType;
  const otherwise = rest.reduceRight<AnySchemaObject>(
    (inner, entry) => conditional(ifType(entry), props(entry), inner),
    props(last),
  );
  return conditional(ifType(first), props(first), otherwise);
};

/**
 * The `fetch` result: each type's item after the context items, its type in the item's `type`
 * enum, and a widget item alone, whose props are its type's, branched in registry order.
 */
export const composeFetchResult = (
  base: AnySchemaObject,
  types: readonly WidgetType[] = WIDGET_TYPES,
): AnySchemaObject => {
  const items = withItems(
    base,
    "contextItem",
    types,
    ({ noun }) =>
      `${capitalised(noun)} as the board document holds it, a molecule's expanded one under its reference's ID.`,
  );
  const item = items.$defs.item;
  if (types.length === 0) return items;
  const type = {
    ...item.properties.type,
    enum: [...item.properties.type.enum, ...types.map((entry) => entry.type)],
  };
  return {
    ...items,
    $defs: {
      ...items.$defs,
      item: {
        ...item,
        properties: { ...item.properties, type },
        ...conditional(
          { properties: { type: { enum: types.map((entry) => entry.type) } } },
          { ...item.then, ...propsBranch(types) },
        ),
      },
    },
  };
};
