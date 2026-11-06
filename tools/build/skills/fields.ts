// The field summaries of the generated skill (askboard-skills, design decision 4): one Markdown line
// for each field of a props or parameter schema, so that what the skill says of a field is what the
// schema says. `$ref`s resolve by `$id` through a resolver and by `#/$defs/<name>` within their
// document; a `$defs` entry is expanded once and later cited as "as `<name>` above", which also
// ends recursion (the Tree's children). Depth stops at four levels. Descriptions lose the
// parentheses that cite a requirement or a design decision, which mean nothing to an agent.

import { SCHEMA_SETS, WIDGET_TYPES } from "@askboard/contract";

export type Schema = Readonly<Record<string, unknown>>;

/** The schema with this `$id`, or undefined. */
export type Resolve = (id: string) => Schema | undefined;

/** How many levels of fields a summary lists before it says to see the example. */
export const MAX_FIELD_LEVELS = 4;

// A parenthesis that starts with an ID of a requirement, a decision or a risk (FR-11, NFR-1, AD-7,
// SM-2, R5), says "since ..." or names a design decision. The leading space goes with it.
const CITATION =
  /\s\((?:(?:FR|NFR|AD|SM)-\d|R\d|since )[^()]*\)|\s\([^()]*design decision[^()]*\)/g;

/** A description without its citations. */
export const stripCitations = (text: string): string => text.replace(CITATION, "").trim();

const isSchema = (value: unknown): value is Schema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const schemasOf = (value: unknown): Schema[] =>
  Array.isArray(value) ? value.filter(isSchema) : [];

/**
 * A resolver over every schema of the contract's sets and every registered widget type, and any
 * `extra` document (a molecule's parameters).
 */
export const contractSchemaResolver = (extra: readonly Schema[] = []): Resolve => {
  const byId = new Map<string, Schema>();
  const add = (schema: unknown) => {
    if (isSchema(schema) && typeof schema.$id === "string") byId.set(schema.$id, schema);
  };
  for (const set of SCHEMA_SETS) for (const schema of set.schemas) add(schema);
  for (const entry of WIDGET_TYPES) {
    add(entry.props);
    add(entry.edits?.changes);
    add(entry.result?.schema);
  }
  for (const schema of extra) add(schema);
  return (id) => byId.get(id);
};

type Resolved = {
  readonly schema: Schema;
  readonly doc: Schema;
  /** The `$defs` name the reference named, when it named one. */
  readonly name: string | undefined;
};

const pointerTarget = (doc: Schema, fragment: string, ref: string): Schema => {
  let node: unknown = doc;
  for (const token of fragment.split("/").slice(1)) {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    node = isSchema(node) ? node[key] : undefined;
  }
  if (!isSchema(node)) throw new Error(`the $ref "${ref}" does not resolve`);
  return node;
};

// Follows `$ref`s to the schema they end at, with the document it lives in. A description beside a
// `$ref` wins over the target's.
const deref = (schema: Schema, doc: Schema, resolve: Resolve): Resolved => {
  let current = schema;
  let currentDoc = doc;
  let name: string | undefined;
  let description = current.description;
  for (let hops = 0; typeof current.$ref === "string"; hops += 1) {
    const ref = current.$ref;
    if (hops > 16) throw new Error(`the $ref "${ref}" does not end`);
    const hash = ref.indexOf("#");
    const id = hash < 0 ? ref : ref.slice(0, hash);
    const fragment = hash < 0 ? "" : ref.slice(hash);
    const target = id === "" ? currentDoc : resolve(id);
    if (target === undefined) throw new Error(`the $ref "${ref}" does not resolve`);
    currentDoc = target;
    current = fragment === "#" || fragment === "" ? target : pointerTarget(target, fragment, ref);
    const defs = /^#\/\$defs\/([^/]+)$/.exec(fragment);
    name = defs?.[1] ?? name;
    description = description ?? current.description;
  }
  return {
    schema: description === undefined ? current : { ...current, description },
    doc: currentDoc,
    name,
  };
};

const range = (low: unknown, high: unknown, unit: string): string | undefined => {
  const lo = typeof low === "number" ? low : undefined;
  const hi = typeof high === "number" ? high : undefined;
  if (lo !== undefined && hi !== undefined) return `${lo} to ${hi}${unit}`;
  const singular = (n: number) => (n === 1 ? unit.replace(/s$/, "") : unit);
  if (hi !== undefined) return `at most ${hi}${singular(hi)}`;
  if (lo !== undefined) return `at least ${lo}${singular(lo)}`;
  return undefined;
};

const plural = (count: unknown, one: string, many: string) => (count === 1 ? one : many);

const textParts = (schema: Schema): string[] => {
  const length = range(schema.minLength, schema.maxLength, " characters");
  return [
    "string",
    ...(typeof schema.pattern === "string" ? [`matching \`${schema.pattern}\``] : []),
    ...(length === undefined ? [] : [length]),
  ];
};

const numberParts = (schema: Schema): string[] => {
  const bounds = range(schema.minimum, schema.maximum, "");
  return [schema.type === "integer" ? "whole number" : "number", ...(bounds ? [bounds] : [])];
};

const countParts = (schema: Schema, itemType: string): string[] => {
  const min = schema.minItems;
  const max = schema.maxItems;
  const parts = [`list of ${itemType}`];
  if (typeof min === "number" && typeof max === "number") parts.push(`${min} to ${max} items`);
  else if (typeof max === "number") parts.push(`at most ${max} ${plural(max, "item", "items")}`);
  else if (typeof min === "number") parts.push(`at least ${min} ${plural(min, "item", "items")}`);
  if (schema.uniqueItems === true) parts.push("each once");
  return parts;
};

type Context = {
  readonly resolve: Resolve;
  readonly descriptions: Readonly<Record<string, string>>;
  readonly expanded: Set<string>;
  readonly lines: string[];
};

// A short name for a schema: a `$defs` name in backticks, else its type in words.
const label = (resolved: Resolved, ctx: Context): string =>
  resolved.name === undefined ? typeParts(resolved, ctx).join(", ") : `\`${resolved.name}\``;

// The bounds of a branch that is a list or a map: "at most 500 items" or "at most 500 entries".
const branchBounds = (schema: Schema): string => {
  const parts: string[] = [];
  const count = (low: unknown, high: unknown, one: string, many: string) => {
    if (typeof low === "number") parts.push(`at least ${low} ${plural(low, one, many)}`);
    if (typeof high === "number") parts.push(`at most ${high} ${plural(high, one, many)}`);
  };
  count(schema.minItems, schema.maxItems, "item", "items");
  count(schema.minProperties, schema.maxProperties, "entry", "entries");
  return parts.length === 0 ? "" : ` (${parts.join(", ")})`;
};

const branchLabel = (branch: Schema, doc: Schema, ctx: Context): string => {
  const resolved = deref(branch, doc, ctx.resolve);
  const name =
    typeof resolved.schema.title === "string" ? resolved.schema.title : label(resolved, ctx);
  return `${name}${branchBounds(resolved.schema)}`;
};

const typeParts = ({ schema, doc }: Resolved, ctx: Context): string[] => {
  const branches = schemasOf(schema.anyOf ?? schema.oneOf);
  if (branches.length > 0) {
    return [`one of: ${branches.map((branch) => branchLabel(branch, doc, ctx)).join("; ")}`];
  }
  if (Array.isArray(schema.enum)) {
    return [`one of ${schema.enum.map((value) => JSON.stringify(value)).join(", ")}`];
  }
  if (schema.const !== undefined) return [`always ${JSON.stringify(schema.const)}`];
  switch (schema.type) {
    case "string":
      return textParts(schema);
    case "integer":
    case "number":
      return numberParts(schema);
    case "boolean":
      return ["true or false"];
    case "array":
      return countParts(
        schema,
        isSchema(schema.items) ? label(deref(schema.items, doc, ctx.resolve), ctx) : "values",
      );
    case "object":
      return [isSchema(schema.additionalProperties) ? "object, one entry for each key" : "object"];
    default:
      return ["value"];
  }
};

const hasChildren = ({ schema, doc }: Resolved, ctx: Context): boolean => {
  if (schemasOf(schema.anyOf ?? schema.oneOf).length > 0) return true;
  if (schema.type === "array" && isSchema(schema.items)) {
    return hasChildren(deref(schema.items, doc, ctx.resolve), ctx);
  }
  return (
    isSchema(schema.properties) ||
    isSchema(schema.patternProperties) ||
    isSchema(schema.additionalProperties)
  );
};

type Field = {
  readonly path: string;
  readonly level: number;
  readonly required: boolean;
  /** What the path's key is, for a key a pattern admits. */
  readonly keyNote?: string;
};

const named = (resolved: Resolved): string | undefined =>
  resolved.name === undefined ? undefined : `${resolved.doc.$id ?? ""}#${resolved.name}`;

// Writes the line of one field, then the fields it holds.
const walk = (raw: Schema, doc: Schema, field: Field, ctx: Context) => {
  const resolved = deref(raw, doc, ctx.resolve);
  const parts = typeParts(resolved, ctx);
  const faults = [
    ...(field.required ? ["required"] : []),
    ...(field.keyNote ? [field.keyNote] : []),
  ];
  const said = stripCitations(
    ctx.descriptions[field.path] ??
      (typeof resolved.schema.description === "string" ? resolved.schema.description : ""),
  );
  const seenAbove = nestedAbove(resolved, ctx);
  const text = seenAbove === undefined ? said : [said, seenAbove].filter(Boolean).join(" ");
  ctx.lines.push(
    `- \`${field.path}\` (${[...faults, ...parts].join(", ")})${text === "" ? "" : `: ${text}`}`,
  );
  if (seenAbove === undefined) nest(resolved, field, ctx);
};

// For a list of, or a field that is, an already expanded `$defs` entry: "as `name` above".
const nestedAbove = (resolved: Resolved, ctx: Context): string | undefined => {
  const { schema, doc } = resolved;
  const isList = schema.type === "array" && isSchema(schema.items);
  const item = isList ? deref(schema.items as Schema, doc, ctx.resolve) : resolved;
  const key = named(item);
  if (key === undefined || !ctx.expanded.has(key) || !hasChildren(item, ctx)) return undefined;
  return `${isList ? "Each as" : "As"} \`${item.name}\` above.`;
};

const nest = (resolved: Resolved, field: Field, ctx: Context) => {
  if (!hasChildren(resolved, ctx)) return;
  if (field.level >= MAX_FIELD_LEVELS) {
    ctx.lines.push(`- \`${field.path}.…\`: see the example`);
    return;
  }
  const { schema, doc } = resolved;
  for (const branch of schemasOf(schema.anyOf ?? schema.oneOf)) {
    nest(deref(branch, doc, ctx.resolve), field, ctx);
  }
  if (schema.type === "array" && isSchema(schema.items)) {
    const item = deref(schema.items, doc, ctx.resolve);
    const key = named(item);
    if (key !== undefined) ctx.expanded.add(key);
    properties(item, { ...field, path: `${field.path}[]` }, ctx);
    return;
  }
  const key = named(resolved);
  if (key !== undefined) ctx.expanded.add(key);
  properties(resolved, field, ctx);
};

const below = (path: string, key: string): string => (path === "" ? key : `${path}.${key}`);

// The fields an object holds, one level below `field`.
const properties = ({ schema, doc }: Resolved, field: Field, ctx: Context) => {
  const required = Array.isArray(schema.required) ? schema.required : [];
  const level = field.level + 1;
  for (const [key, sub] of Object.entries(isSchema(schema.properties) ? schema.properties : {})) {
    if (isSchema(sub)) {
      walk(
        sub,
        doc,
        { path: below(field.path, key), level, required: required.includes(key) },
        ctx,
      );
    }
  }
  for (const [pattern, sub] of Object.entries(
    isSchema(schema.patternProperties) ? schema.patternProperties : {},
  )) {
    if (isSchema(sub)) {
      const keyNote = `the key matches \`${pattern}\``;
      walk(sub, doc, { path: below(field.path, "<field>"), level, required: false, keyNote }, ctx);
    }
  }
  if (isSchema(schema.additionalProperties)) {
    walk(
      schema.additionalProperties,
      doc,
      { path: below(field.path, "<key>"), level, required: false },
      ctx,
    );
  }
};

/**
 * One line for each field of an object schema, in schema order, as
 * "- `nodes[].id` (required, string matching `^...$`): description". `descriptions` replaces the
 * description of a field by its path. Throws, naming it, on a `$ref` that does not resolve.
 */
export const fieldLines = (
  schema: Schema,
  resolve: Resolve,
  descriptions: Readonly<Record<string, string>> = {},
): string[] => {
  const ctx: Context = { resolve, descriptions, expanded: new Set(), lines: [] };
  const top = deref(schema, schema, resolve);
  // The top object's own fields are the first level: a path starts with the field's name alone.
  const root: Field = { path: "", level: 0, required: false };
  properties(top, root, ctx);
  return ctx.lines;
};
