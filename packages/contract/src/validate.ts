// Validation against the contract's schemas with Ajv, the one validator (AD-7, Stack). The schemas
// compile once, at the first validation (design decision 2). The board page cannot compile under
// its CSP, so the view build generates standalone validators from `createAjv` instead.

import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import { schemaErrors } from "./compiled.ts";
import { type BoardDocument, boardDocumentSet } from "./schemas/board-document/index.ts";
import {
  BOARD_PROTOCOL_MESSAGES,
  type BoardMessageDirection,
  boardProtocol,
  type HostMessage,
  type PageMessage,
} from "./schemas/board-protocol/index.ts";
import {
  type ManifestChunk,
  type ViewManifest,
  viewManifestSet,
} from "./schemas/view-manifest/index.ts";
import { SCHEMA_IDS } from "./sets.ts";
import { majorOf, SCHEMA_SET_OWNERS, type SchemaSet, unsupportedVersion } from "./versions.ts";

/** One problem, at a JSON Pointer into the value. */
export type Problem = { readonly path: string; readonly message: string };

export type Checked<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      /** `version`: a major this receiver does not support; `schema`: anything else. */
      readonly reason: "version" | "schema";
      readonly problems: readonly Problem[];
    };

export { createAjv } from "./compiled.ts";
export {
  type CheckedRequest,
  type CollectWait,
  type RequestProblem,
  toolInputProblems,
  validateAskRequest,
  validateCollectRequest,
} from "./requests.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A problem names the field it is about: an unknown or missing field joins the path.
const problemOf = ({ keyword, instancePath, params, message }: ErrorObject): Problem => {
  if (keyword === "additionalProperties") {
    const field = String(params.additionalProperty);
    return { path: `${instancePath}/${field}`, message: `unknown field "${field}"` };
  }
  if (keyword === "required") {
    const field = String(params.missingProperty);
    return { path: `${instancePath}/${field}`, message: `missing field "${field}"` };
  }
  return { path: instancePath || "/", message: message ?? "is invalid" };
};

/** Validates a value against one contract schema, by its `$id`. */
export const validateAgainst = <T = unknown>(id: string, value: unknown): Checked<T> => {
  const errors = schemaErrors(id, value);
  if (errors.length === 0) return { ok: true, value: value as T };
  return { ok: false, reason: "schema", problems: errors.map(problemOf) };
};

/** Refuses an unsupported major before the schema runs, saying which version is supported. */
export const validateVersioned = <T>(set: SchemaSet, id: string, value: unknown): Checked<T> => {
  const refusal = unsupportedVersion(set, isRecord(value) ? value.version : undefined);
  if (refusal !== undefined) {
    return { ok: false, reason: "version", problems: [{ path: "/version", message: refusal }] };
  }
  return validateAgainst<T>(id, value);
};

export const validateBoardDocument = (value: unknown): Checked<BoardDocument> =>
  validateVersioned(boardDocumentSet, SCHEMA_IDS.boardDocument, value);

const SENDERS: Record<BoardMessageDirection, string> = {
  toHost: "the board page",
  toPage: "board-host",
};

/**
 * Validates a board-protocol message by its direction: `toHost` for what the board page sends,
 * `toPage` for what `board-host` sends. The version is checked first, then the message's `type`
 * picks its schema.
 */
export function validateBoardMessage(direction: "toHost", value: unknown): Checked<PageMessage>;
export function validateBoardMessage(direction: "toPage", value: unknown): Checked<HostMessage>;
export function validateBoardMessage(
  direction: BoardMessageDirection,
  value: unknown,
): Checked<PageMessage | HostMessage>;
export function validateBoardMessage(
  direction: BoardMessageDirection,
  value: unknown,
): Checked<PageMessage | HostMessage> {
  if (!isRecord(value)) {
    return {
      ok: false,
      reason: "schema",
      problems: [{ path: "/", message: "a board-protocol message is a JSON object" }],
    };
  }
  const refusal = unsupportedVersion(boardProtocol, value.version);
  if (refusal !== undefined) {
    return { ok: false, reason: "version", problems: [{ path: "/version", message: refusal }] };
  }
  // An own property only: an inherited name such as `constructor` names no message.
  const schemas: Readonly<Record<string, string>> = BOARD_PROTOCOL_MESSAGES[direction];
  const id =
    typeof value.type === "string" && Object.hasOwn(schemas, value.type)
      ? schemas[value.type]
      : undefined;
  if (id === undefined) {
    const message = `${JSON.stringify(value.type ?? null)} is not a message ${SENDERS[direction]} sends`;
    return { ok: false, reason: "schema", problems: [{ path: "/type", message }] };
  }
  return validateAgainst(id, value);
}

type Chunks = ViewManifest["chunks"];

const KIND_NAMES: Readonly<Record<ManifestChunk["kind"], string>> = {
  shell: "a shell chunk",
  library: "a library chunk",
  component: "a component chunk",
};

// A needed chunk that exists must be a library, unless a component chunk needs it.
const needProblems = (chunks: Chunks, name: string, chunk: ManifestChunk): Problem[] =>
  chunk.needs.flatMap((needed, index) => {
    const path = `/chunks/${name}/needs/${index}`;
    if (!Object.hasOwn(chunks, needed)) {
      return [{ path, message: `needs the chunk "${needed}", which is not in the manifest` }];
    }
    const kind = chunks[needed]?.kind;
    if (chunk.kind === "component" || kind === "library" || kind === undefined) return [];
    const who = chunk.kind === "shell" ? "the shell" : "a library chunk";
    const message = `${who} needs only library chunks, and "${needed}" is ${KIND_NAMES[kind]}`;
    return [{ path, message }];
  });

// Each cycle of `needs` once, as the chunk names along it with the first repeated at the end.
const needCycles = (chunks: Chunks): string[][] => {
  const cycles: string[][] = [];
  const done = new Set<string>();
  const visit = (name: string, trail: readonly string[]): void => {
    const start = trail.indexOf(name);
    if (start !== -1) {
      cycles.push([...trail.slice(start), name]);
      return;
    }
    const chunk = Object.hasOwn(chunks, name) ? chunks[name] : undefined;
    if (done.has(name) || chunk === undefined) return;
    for (const needed of chunk.needs) visit(needed, [...trail, name]);
    done.add(name);
  };
  for (const name of Object.keys(chunks)) visit(name, []);
  return cycles;
};

// What the manifest's schema cannot say: every needed chunk exists, the shell and the libraries
// need only libraries, no chunk needs itself through any path, there is exactly one shell, exactly
// the component chunks name components, and no two chunks register one component.
const manifestProblems = ({ chunks }: ViewManifest): Problem[] => {
  const problems: Problem[] = [];
  const entries = Object.entries(chunks);
  const registrars = new Map<string, string>();
  for (const [name, chunk] of entries) {
    problems.push(...needProblems(chunks, name, chunk));
    const component = chunk.kind === "component";
    if (component !== (chunk.components !== undefined)) {
      const message = component
        ? "a component chunk names the components it registers"
        : "only a component chunk names components";
      problems.push({ path: `/chunks/${name}/components`, message });
    }
    if (!component) continue;
    chunk.components?.forEach((registered, index) => {
      const first = registrars.get(registered);
      if (first === undefined) registrars.set(registered, name);
      else {
        const message = `the chunk "${first}" registers the component "${registered}" too`;
        problems.push({ path: `/chunks/${name}/components/${index}`, message });
      }
    });
  }
  for (const cycle of needCycles(chunks)) {
    const message = `the chunks need each other in a cycle: ${cycle.join(" → ")}`;
    problems.push({ path: `/chunks/${cycle[0]}/needs`, message });
  }
  const shells = entries.filter(([, chunk]) => chunk.kind === "shell").length;
  if (shells !== 1) {
    const message = `the manifest has ${shells} shell chunks, and needs exactly one`;
    problems.push({ path: "/chunks", message });
  }
  return problems;
};

export const validateViewManifest = (value: unknown): Checked<ViewManifest> => {
  const checked = validateVersioned<ViewManifest>(viewManifestSet, SCHEMA_IDS.viewManifest, value);
  if (!checked.ok) return checked;
  const problems = manifestProblems(checked.value);
  return problems.length === 0 ? checked : { ok: false, reason: "schema", problems };
};

const DIALECT = "https://json-schema.org/draft/2020-12/schema";
const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
const ROOT_COMBINATORS = ["oneOf", "anyOf", "allOf"];

const setProblems = ({ name, title, owner, version }: SchemaSet): string[] => {
  const problems: string[] = [];
  const expected = Object.hasOwn(SCHEMA_SET_OWNERS, name) ? SCHEMA_SET_OWNERS[name] : undefined;
  if (expected === undefined) {
    problems.push(`${title}: owner ${owner}, but AD-7's table has no set "${name}"`);
  } else if (expected !== owner) {
    problems.push(`${title}: owner ${owner}, but AD-7's table gives "${name}" to ${expected}`);
  }
  if (majorOf(version) === undefined) {
    problems.push(`${title}: version ${JSON.stringify(version)} is not major.minor`);
  }
  return problems;
};

const shapeProblems = (set: SchemaSet, schema: Record<string, unknown>): string[] => {
  const where = `${set.title}, ${typeof schema.$id === "string" ? schema.$id : "(no $id)"}`;
  const problems: string[] = [];
  if (schema.$schema !== DIALECT) problems.push(`${where}: $schema is not JSON Schema 2020-12`);
  const namespace = `urn:askboard:${set.name}:`;
  if (typeof schema.$id !== "string" || !schema.$id.startsWith(namespace)) {
    problems.push(`${where}: $id outside ${namespace}`);
  }
  for (const keyword of ROOT_COMBINATORS) {
    if (keyword in schema) problems.push(`${where}: root ${keyword}`);
  }
  return problems;
};

/**
 * The schema checks of the Consistency Conventions: every set has the owner AD-7's table gives it
 * and a `major.minor` version; every schema is JSON Schema 2020-12 with an `$id` in its set's
 * namespace, has no root combinator, and compiles in strict mode with the sets it references.
 */
export const schemaSetProblems = (sets: readonly SchemaSet[]): string[] => {
  const problems = sets.flatMap(setProblems);
  const checker = new Ajv2020({ strict: true, allErrors: true });
  const compilable: [SchemaSet, Record<string, unknown>][] = [];
  for (const set of sets) {
    for (const schema of set.schemas as Record<string, unknown>[]) {
      const shape = shapeProblems(set, schema);
      problems.push(...shape);
      if (shape.length > 0) continue;
      try {
        checker.addSchema(schema);
        compilable.push([set, schema]);
      } catch (error) {
        problems.push(`${set.title}, ${schema.$id}: cannot be added: ${messageOf(error)}`);
      }
    }
  }
  for (const [set, schema] of compilable) {
    try {
      checker.getSchema(schema.$id as string);
    } catch (error) {
      problems.push(`${set.title}, ${schema.$id}: does not compile: ${messageOf(error)}`);
    }
  }
  return problems;
};
