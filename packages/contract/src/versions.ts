// Schema sets and their versions (AD-7). Every set has one owning unit and a semantic version,
// written `major.minor` on the wire; a receiver compares the major only (design decision 2).
// A minor keeps its major's meaning: it may add fields and enum values, make a required field
// optional, and lift or add a limit. Every schema refuses what it does not define or allow, so a
// receiver still on an older minor refuses a newer minor's additions as schema errors, and one on a
// newer minor refuses what a limit that minor added excludes. A sender therefore uses a minor's
// additions only once every receiver of the set has that minor, and a receiver applies its limits
// only once every sender has it; within AskBoard both hold, because one session process serves
// both ends.

/** The units that own a schema set, from AD-7's table. */
export type SchemaOwner =
  | "contract"
  | "mcp-tools"
  | "ask-core"
  | "board-host"
  | "view"
  | "snapshot"
  | "bench";

/** AD-7's table: the owning unit of each schema set, by the set's name. */
export const SCHEMA_SET_OWNERS: Readonly<Record<string, SchemaOwner>> = {
  input: "contract",
  output: "contract",
  "tool-envelopes": "mcp-tools",
  "board-document": "ask-core",
  "board-protocol": "board-host",
  "view-manifest": "view",
  "local-api": "board-host",
  "session-file": "board-host",
  configuration: "ask-core",
  "snapshot-data": "snapshot",
  "bench-timing": "bench",
};

export type SchemaSet = {
  /** The set's folder under `src/schemas/`, and the second part of its schemas' `$id`. */
  readonly name: string;
  /** How a refusal names the set, such as "board protocol". */
  readonly title: string;
  readonly owner: SchemaOwner;
  /** `major.minor`. */
  readonly version: string;
  readonly schemas: readonly object[];
};

const VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/** The major of a `major.minor` version, or undefined when it is not one. */
export const majorOf = (version: unknown): number | undefined => {
  const match = typeof version === "string" ? VERSION.exec(version) : null;
  return match ? Number(match[1]) : undefined;
};

/**
 * Why a document or message that names `version` is refused, or undefined when this receiver
 * supports its major. The reason names the version the receiver supports.
 */
export const unsupportedVersion = (
  set: Pick<SchemaSet, "title" | "version">,
  version: unknown,
): string | undefined => {
  const supported = majorOf(set.version);
  const named = majorOf(version);
  if (named !== undefined && named === supported) return undefined;
  const what =
    named === undefined
      ? `names no ${set.title} version`
      : `is ${set.title} version ${String(version)}, which is not supported`;
  return `the message ${what}: this receiver supports version ${supported} (${set.version})`;
};
