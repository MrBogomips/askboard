import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { LIFECYCLE, lifecycleSnapshotResult } from "../src/fixtures/index.ts";
import {
  OUTPUT_FORMAT_VERSION,
  RESULT_VERSIONS,
  SCHEMA_IDS,
  SERVER_INSTRUCTIONS,
  SNAPSHOT_NAME_PATTERN,
  TOOL_DEFINITIONS,
  TOOL_ENVELOPES_VERSION,
  toolEnvelopes,
} from "../src/index.ts";
import { validateAgainst, validateSnapshotRequest } from "../src/validate.ts";

// The snapshot tool's envelopes (snapshot task 1.2; contract spec, The snapshot tool's envelopes,
// The approved snapshot definition): the approved definition as the fifth tool, its request built
// from it, its result and the typed discarded result, after E3's pattern for fetch.

const fixture = (name: string) => Bun.file(join(import.meta.dir, "fixtures", name));
const approved = (await fixture("tools.json").json()) as { tools: { name: string }[] };

type Json = Record<string, unknown>;
const pathsOf = (id: string, value: unknown) => {
  const checked = validateAgainst(id, value);
  return checked.ok ? [] : checked.problems.map((problem) => problem.path);
};
const idOf = (schema: object) => (schema as Json).$id;

const result = lifecycleSnapshotResult;
const discarded = {
  versions: RESULT_VERSIONS,
  epoch: LIFECYCLE.epoch,
  askId: LIFECYCLE.askId,
  outcome: "discarded",
};

describe("the approved snapshot definition", () => {
  test("the tool definitions are the approved tools.json whole: five tools, in order", () => {
    expect(TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "ask",
      "update",
      "collect",
      "fetch",
      "snapshot",
    ]);
    expect(TOOL_DEFINITIONS).toEqual(approved.tools as never);
  });

  test("snapshot keeps its approved annotations: not destructive, not open-world", () => {
    expect(TOOL_DEFINITIONS.at(-1)?.annotations).toEqual({
      destructiveHint: false,
      openWorldHint: false,
    });
  });

  test("the server instructions stay the approved text, which names no snapshot", async () => {
    expect(SERVER_INSTRUCTIONS).toBe((await fixture("server-instructions.md").text()).trimEnd());
    expect(SERVER_INSTRUCTIONS).not.toMatch(/\bsnapshot\b/);
  });
});

describe("the snapshot request", () => {
  test("is the definition's input schema, under its own $id, and names no version", () => {
    const schema = toolEnvelopes.schemas.find(
      (candidate) => idOf(candidate) === SCHEMA_IDS.snapshotRequest,
    ) as Json;
    const { $schema: _, $id: __, title: ___, ...input } = schema;
    expect(input).toEqual(TOOL_DEFINITIONS.at(-1)?.inputSchema as never);
    const request = { askId: LIFECYCLE.askId };
    expect(validateAgainst(SCHEMA_IDS.snapshotRequest, request).ok).toBe(true);
    const versioned = { ...request, versions: RESULT_VERSIONS };
    expect(pathsOf(SCHEMA_IDS.snapshotRequest, versioned)).toEqual(["/versions"]);
  });

  test("validateSnapshotRequest takes an ask ID alone", () => {
    const request = { askId: LIFECYCLE.askId };
    expect(validateSnapshotRequest(request)).toEqual({ ok: true, value: request });
  });

  test.each([
    ["a path", { askId: LIFECYCLE.askId, path: "/tmp/board.html" }, "/path", "path"],
    ["no ask ID", {}, "/askId", "askId"],
    ["a malformed ask ID", { askId: "checkout plan" }, "/askId", "askId"],
  ])("a request with %s is refused, naming the field", (_, request, path, field) => {
    const checked = validateSnapshotRequest(request);
    expect(checked.ok).toBe(false);
    if (checked.ok) return;
    expect(checked.problems.map((problem) => [problem.path, problem.field])).toEqual([
      [path, field],
    ]);
  });

  test("a request that is not an object is refused at the root", () => {
    const checked = validateSnapshotRequest("checkout-plan-p8r3");
    expect(checked.ok ? [] : checked.problems.map((problem) => problem.path)).toEqual(["/"]);
  });
});

describe("the snapshot result", () => {
  test("the fixture's result validates and names a result and an output version", () => {
    expect(validateAgainst(SCHEMA_IDS.snapshotResult, result)).toEqual({ ok: true, value: result });
    expect(result.versions).toEqual({
      result: TOOL_ENVELOPES_VERSION,
      output: OUTPUT_FORMAT_VERSION,
    });
    const { versions: _, ...bare } = result;
    expect(pathsOf(SCHEMA_IDS.snapshotResult, bare)).toEqual(["/versions"]);
  });

  test("its path is absolute and ends in a Snapshot file's name", () => {
    expect(result.path).toStartWith("/");
    const name = result.path.split("/").at(-1) ?? "";
    expect(name).toMatch(new RegExp(SNAPSHOT_NAME_PATTERN));
    expect(name).toStartWith(`${LIFECYCLE.askId}-`);
  });

  test("an unchecked ask's result says so, and only ever with true", () => {
    expect(pathsOf(SCHEMA_IDS.snapshotResult, { ...result, unchecked: true })).toEqual([]);
    expect(pathsOf(SCHEMA_IDS.snapshotResult, { ...result, unchecked: false })).toEqual([
      "/unchecked",
    ]);
  });

  test.each([
    ["a relative path", { path: ".askboard/snapshots/board.html" }, "/path"],
    ["an empty path", { path: "" }, "/path"],
    ["no path", { path: undefined }, "/path"],
    ["no state", { state: undefined }, "/state"],
    ["file content", { html: "<!doctype html>" }, "/html"],
    ["the board link", { board: LIFECYCLE.link }, "/board"],
  ])("a result with %s fails, naming the field", (_, fields, path) => {
    const changed = JSON.parse(JSON.stringify({ ...result, ...fields }));
    expect(pathsOf(SCHEMA_IDS.snapshotResult, changed)).toContain(path);
  });

  test("the typed discarded result names the ask and nothing else", () => {
    expect(validateAgainst(SCHEMA_IDS.snapshotOutcome, discarded).ok).toBe(true);
    const withPath = { ...discarded, path: result.path };
    expect(pathsOf(SCHEMA_IDS.snapshotOutcome, withPath)).toEqual(["/path"]);
    const closed = { ...discarded, outcome: "closed" };
    expect(pathsOf(SCHEMA_IDS.snapshotOutcome, closed)).toEqual(["/outcome"]);
  });
});

describe("the registrations (Snapshot registrations are appended)", () => {
  test("the tool envelopes take their next minor, which every result names", () => {
    expect(TOOL_ENVELOPES_VERSION).toBe("1.3");
    expect(toolEnvelopes.version).toBe(TOOL_ENVELOPES_VERSION);
    expect(RESULT_VERSIONS).toEqual({ result: "1.3", output: OUTPUT_FORMAT_VERSION });
  });

  test("the envelopes' new schemas follow the earlier ones, in their order", () => {
    expect(toolEnvelopes.schemas.map(idOf).slice(-3)).toEqual([
      "urn:askboard:tool-envelopes:snapshot-request",
      "urn:askboard:tool-envelopes:snapshot-result",
      "urn:askboard:tool-envelopes:snapshot-outcome",
    ]);
    expect(toolEnvelopes.schemas.map(idOf).slice(0, 13).at(-1)).toBe(
      "urn:askboard:tool-envelopes:fetch-outcome",
    );
  });

  test("their IDs are appended to SCHEMA_IDS, after every earlier entry", () => {
    const keys = Object.keys(SCHEMA_IDS);
    // E8 (settings-languages) appends its own after these.
    const first = keys.indexOf("boardImageProps") + 1;
    expect(keys.slice(first, first + 3)).toEqual([
      "snapshotRequest",
      "snapshotResult",
      "snapshotOutcome",
    ]);
    expect(SCHEMA_IDS.snapshotResult).toBe("urn:askboard:tool-envelopes:snapshot-result");
  });
});
