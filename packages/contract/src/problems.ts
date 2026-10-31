// Problems in a tool request, worded for the agent that must fix it (AD-6): each names its field,
// the item it is in when that item has a usable ID, and the expected shape, and the problems of a
// request come in document order, so the first problems come first.

import type { ErrorObject } from "ajv/dist/2020";
import type { Problem } from "./validate.ts";

/** A problem in a tool request. */
export type RequestProblem = Problem & {
  /** The item the problem is in, when the item has a usable ID. */
  readonly itemId?: string;
  /** The field: from the item when `itemId` is set (`props.options`), else from the request. */
  readonly field: string;
  /** The shape the field must have, in words. */
  readonly expected: string;
};

export type Segments = readonly string[];

/** Where a schema error points, and whether it is about an unknown or a missing field. */
export type Located = {
  readonly segments: Segments;
  readonly kind: "unknown" | "missing" | "invalid";
};

/** How a request's problems are worded. */
export type Wording = {
  /** The field name of the whole request. */
  readonly root: string;
  /** The expected shape of each field, by key (`items[].props.options[].label`). */
  readonly expected: Readonly<Record<string, string>>;
  /** What each object holds, by key, for a field it does not define. */
  readonly fields: Readonly<Record<string, string>>;
  /** The item a path is in, with the path from that item, when the item has a usable ID. */
  readonly itemOf?: (value: unknown, segments: Segments) => ItemPath | undefined;
};

export type ItemPath = { readonly itemId: string; readonly rest: Segments };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIndex = (segment: string): boolean => /^(0|[1-9][0-9]*)$/.test(segment);

export const pointer = (segments: Segments): string =>
  segments.length === 0
    ? "/"
    : segments.map((part) => `/${part.replaceAll("~", "~0").replaceAll("/", "~1")}`).join("");

const segmentsOf = (path: string): string[] =>
  path === "" || path === "/"
    ? []
    : path
        .slice(1)
        .split("/")
        .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));

const joined = (segments: Segments, index: (part: string) => string): string =>
  segments.map((part, at) => (isIndex(part) ? index(part) : at === 0 ? part : `.${part}`)).join("");

/** `props.options[1].label` from ["props", "options", "1", "label"]. */
const fieldOf = (segments: Segments): string => joined(segments, (part) => `[${part}]`);

/** The key of a field in a wording's tables: `items[].props.options[].label`. */
const keyOf = (segments: Segments): string => joined(segments, () => "[]");

export const located = (error: ErrorObject): Located => {
  const segments = segmentsOf(error.instancePath);
  if (error.keyword === "additionalProperties") {
    return { segments: [...segments, String(error.params.additionalProperty)], kind: "unknown" };
  }
  if (error.keyword === "required") {
    return { segments: [...segments, String(error.params.missingProperty)], kind: "missing" };
  }
  return { segments, kind: "invalid" };
};

/**
 * A problem at a field. `message` may hold `{where}`, which becomes the field, preceded by its
 * item when the item has a usable ID.
 */
export const problemAt = (
  wording: Wording,
  value: unknown,
  segments: Segments,
  message: string,
  expected: string,
): RequestProblem => {
  const item = wording.itemOf?.(value, segments);
  const field = item
    ? fieldOf(item.rest)
    : segments.length === 0
      ? wording.root
      : fieldOf(segments);
  const where = item ? `item "${item.itemId}", ${field}` : field;
  return {
    path: pointer(segments),
    ...(item ? { itemId: item.itemId } : {}),
    field,
    expected,
    message: message.replace("{where}", where),
  };
};

/** The expected shape of a field in a wording, by its path. */
export const expectedAt = (wording: Wording, segments: Segments): string =>
  wording.expected[keyOf(segments)] ?? "a value the contract defines";

/** A schema error, worded. */
export const schemaProblem = (
  wording: Wording,
  value: unknown,
  { segments, kind }: Located,
): RequestProblem => {
  if (kind === "unknown") {
    const allowed = wording.fields[keyOf(segments.slice(0, -1))] ?? "the field is not defined";
    return problemAt(wording, value, segments, `{where} is not accepted: ${allowed}`, allowed);
  }
  const expected = expectedAt(wording, segments);
  if (kind === "missing") {
    return problemAt(wording, value, segments, `{where} is required: ${expected}`, expected);
  }
  if (segments.length === 0) {
    const message = `${wording.root} must be ${expected}`;
    return problemAt(wording, value, segments, message, expected);
  }
  return problemAt(wording, value, segments, `{where} must be ${expected}`, expected);
};

// Each JSON Pointer of the value, in document order.
const documentOrder = (value: unknown): Map<string, number> => {
  const order = new Map<string, number>();
  const visit = (node: unknown, segments: string[]): void => {
    order.set(pointer(segments), order.size);
    const children = Array.isArray(node)
      ? node.entries()
      : isRecord(node)
        ? Object.entries(node)
        : [];
    for (const [key, child] of children) visit(child, [...segments, String(key)]);
  };
  visit(value, []);
  return order;
};

/**
 * The problems without repeats, in document order: a problem sorts at its field, or at the nearest
 * field above it that the request holds, as for a missing field.
 */
export const inDocumentOrder = (value: unknown, problems: readonly RequestProblem[]) => {
  const order = documentOrder(value);
  const rank = (path: string): number => {
    const segments = segmentsOf(path);
    for (let length = segments.length; length > 0; length -= 1) {
      const index = order.get(pointer(segments.slice(0, length)));
      if (index !== undefined) return index;
    }
    return 0;
  };
  const seen = new Set<string>();
  return problems
    .filter(({ path, message }) => {
      const key = `${path}\n${message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((entry, position) => ({ entry, position, rank: rank(entry.path) }))
    .sort((a, b) => a.rank - b.rank || a.position - b.position)
    .map(({ entry }) => entry);
};
