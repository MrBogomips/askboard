// What a molecule definition's schema cannot say (design decision 2): its parameters are one JSON
// Schema 2020-12 object schema whose `$id` is `urn:askboard:molecule:<molecule>:<major>`, with no
// root combinator; each fill names a declared parameter and a place inside the item's props whose
// parent exists in the composition; no two fills share a place or nest, so the order of the fills
// never matters; an `item` fill fills text or a key the composition leaves out; and no string or
// key holds markup or a `javascript:` URL (AD-8, NFR-5). The format's major and the item count
// are checked by the validator, before the schema runs.
//
// Plain ECMAScript with no JSON and no Ajv. Problems are E1's, at a JSON Pointer into the
// definition, naming the parameter, the pointer or the string.

import type { Problem } from "../validate.ts";
import type { MoleculeDefinition, MoleculeFill } from "./index.ts";
import { pointerOf, pointerTokens, valueAt } from "./pointer.ts";

type Json = Readonly<Record<string, unknown>>;
type Path = readonly (string | number)[];

const DIALECT = "https://json-schema.org/draft/2020-12/schema";
const ROOT_COMBINATORS = ["oneOf", "anyOf", "allOf"] as const;
const INDEX = /^(0|[1-9][0-9]*)$/;
const SCRIPT_URL = /javascript:/i;
// URL parsers drop these from a scheme, so `java\tscript:` is a script URL too.
const URL_IGNORED = /[\t\n\r]/g;
const NO_CODE = "a molecule carries no markup or script";

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parametersProblems = ({ molecule, version, parameters }: MoleculeDefinition): Problem[] => {
  const problems: Problem[] = [];
  if (parameters.$schema !== DIALECT) {
    const message = `the parameters are not JSON Schema 2020-12 (${DIALECT})`;
    problems.push({ path: "/parameters/$schema", message });
  }
  const id = `urn:askboard:molecule:${molecule}:${version.split(".")[0]}`;
  if (parameters.$id !== id) {
    const message = `the parameters' $id is ${JSON.stringify(parameters.$id ?? null)}, where this definition's is "${id}"`;
    problems.push({ path: "/parameters/$id", message });
  }
  for (const keyword of ROOT_COMBINATORS) {
    if (!Object.hasOwn(parameters, keyword)) continue;
    const message = `the parameters have ${keyword} at their root, where a molecule's parameters are one object schema`;
    problems.push({ path: `/parameters/${keyword}`, message });
  }
  if (parameters.type !== "object") {
    const message = `the parameters are of the type ${JSON.stringify(parameters.type ?? null)}, where a molecule's parameters are an object schema`;
    problems.push({ path: "/parameters/type", message });
  }
  return problems;
};

const kindOf = (value: unknown): string => {
  if (Array.isArray(value)) return "a list";
  if (value === null) return "null";
  return typeof value === "object" ? "an object" : `a ${typeof value}`;
};

// Why a parent cannot take the key `last`, or `undefined` when it can.
const parentFault = (parent: string, found: boolean, value: unknown, last: string) => {
  if (!found) return `"${parent}" holds nothing to fill`;
  if (Array.isArray(value)) {
    return INDEX.test(last) && Number(last) < value.length
      ? undefined
      : `the list "${parent}" has no index "${last}"`;
  }
  return isObject(value)
    ? undefined
    : `"${parent}" holds ${kindOf(value)}, not an object or a list`;
};

/** A fill's place in the composition, once its pointer is known to be a good one. */
type Place = {
  readonly parameter: string;
  readonly path: string;
  readonly tokens: readonly string[];
};

// One fill's own problems: a pointer inside the item's props, a parent that can take its key, and,
// for an `item` fill, text or nothing at the place.
const fillProblems = (items: unknown, fill: MoleculeFill, path: string): Problem[] => {
  const { pointer } = fill;
  const tokens = pointerTokens(pointer) ?? [];
  if (tokens.length < 2 || tokens[0] !== "0" || tokens[1] !== "props") {
    const message = `the pointer "${pointer}" is outside the item's props: a fill fills /0/props or a place inside it`;
    return [{ path, message }];
  }
  const parentTokens = tokens.slice(0, -1);
  const parent = valueAt(items, parentTokens);
  const value = parent.found ? parent.value : undefined;
  const fault = parentFault(pointerOf(parentTokens), parent.found, value, tokens.at(-1) ?? "");
  if (fault !== undefined) {
    return [
      { path, message: `the pointer "${pointer}" names no place in the composition: ${fault}` },
    ];
  }
  const target = valueAt(items, tokens);
  if (fill.as !== "item" || !target.found || typeof target.value === "string") return [];
  const message = `the item fill's pointer "${pointer}" holds ${kindOf(target.value)}, where an item fill fills text or a key the composition leaves out`;
  return [{ path, message }];
};

const startsWith = (tokens: readonly string[], prefix: readonly string[]): boolean =>
  prefix.length <= tokens.length && prefix.every((token, at) => tokens[at] === token);

// The conflicts of a place with the places before it: the same place, or one inside the other.
const conflictProblems = (place: Place, before: readonly Place[]): Problem[] =>
  before.flatMap((other): Problem[] => {
    const pointer = pointerOf(place.tokens);
    const otherPointer = pointerOf(other.tokens);
    const by = `the parameter "${other.parameter}"`;
    let message: string | undefined;
    if (pointer === otherPointer) message = `${by} fills the pointer "${pointer}" already`;
    else if (startsWith(place.tokens, other.tokens)) {
      message = `the pointer "${pointer}" lies inside "${otherPointer}", which ${by} fills`;
    } else if (startsWith(other.tokens, place.tokens)) {
      message = `the pointer "${pointer}" holds "${otherPointer}", which ${by} fills`;
    }
    return message === undefined ? [] : [{ path: place.path, message }];
  });

const fillsProblems = ({ parameters, items, fills }: MoleculeDefinition): Problem[] => {
  const declared = isObject(parameters.properties) ? parameters.properties : {};
  const problems: Problem[] = [];
  const places: Place[] = [];
  for (const [parameter, list] of Object.entries(fills)) {
    if (!Object.hasOwn(declared, parameter)) {
      const message = `the fills name the parameter "${parameter}", which the parameters do not declare`;
      problems.push({ path: pointerOf(["fills", parameter]), message });
      continue;
    }
    list.forEach((fill, at) => {
      const path = pointerOf(["fills", parameter, at, "pointer"]);
      const own = fillProblems(items, fill, path);
      problems.push(...own);
      if (own.length > 0) return;
      const place: Place = { parameter, path, tokens: pointerTokens(fill.pointer) ?? [] };
      problems.push(...conflictProblems(place, places));
      places.push(place);
    });
  }
  return problems;
};

const textFault = (text: string): string | undefined => {
  if (text.includes("<")) return 'holds markup ("<")';
  return SCRIPT_URL.test(text.replace(URL_IGNORED, "")) ? "holds a javascript: URL" : undefined;
};

// Every string and key of the definition, in document order.
const codeProblems = (value: unknown, path: Path): Problem[] => {
  if (typeof value === "string") {
    const fault = textFault(value);
    return fault === undefined
      ? []
      : [{ path: pointerOf(path), message: `the text ${fault}, and ${NO_CODE}` }];
  }
  if (Array.isArray(value)) return value.flatMap((child, at) => codeProblems(child, [...path, at]));
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const fault = textFault(key);
    const own =
      fault === undefined
        ? []
        : [{ path: pointerOf([...path, key]), message: `the key ${fault}, and ${NO_CODE}` }];
    return [...own, ...codeProblems(child, [...path, key])];
  });
};

/**
 * What the definition format's schema cannot say about a definition that passed it: its
 * parameters, its fills and the absence of code. Never throws.
 */
export const moleculeDefinitionProblems = (definition: MoleculeDefinition): Problem[] => [
  ...parametersProblems(definition),
  ...fillsProblems(definition),
  ...codeProblems(definition, []),
];
