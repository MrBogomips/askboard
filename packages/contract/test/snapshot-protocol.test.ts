import { describe, expect, test } from "bun:test";
import {
  LIFECYCLE,
  snapshotProtocolExamples,
  snapshotTranscript,
  snapshotTranscripts,
} from "../src/fixtures/index.ts";
import {
  ACTION_ID_PATTERN,
  BOARD_PROTOCOL_MESSAGES,
  BOARD_PROTOCOL_VERSION,
  boardProtocol,
  SCHEMA_IDS,
} from "../src/index.ts";
import { type Checked, validateBoardMessage } from "../src/validate.ts";

// The board protocol's Snapshot messages (snapshot task 1.3; contract spec, Snapshot messages on
// the board protocol, Snapshot registrations are appended), added by E3's decision 8 steps.

const version = BOARD_PROTOCOL_VERSION;
const requestId = "dQ7rU2nVx5LpS8wKa3fYgC";
const path = `/home/sara/shop/.askboard/snapshots/${LIFECYCLE.askId}-20261031T143000Z-k3x9a1.html`;
const folder = "/home/sara/shop/.askboard/snapshots";
const paths = (checked: Checked<unknown>) =>
  checked.ok ? [] : checked.problems.map((problem) => problem.path);
const toHost = (message: object) => paths(validateBoardMessage("toHost", message));
const toPage = (message: object) => paths(validateBoardMessage("toPage", message));
const idOf = (schema: object) => (schema as Record<string, unknown>).$id;

describe("the registrations", () => {
  test("the earlier messages keep their order in each direction, and E7's follow them, E8's after", () => {
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toHost)).toEqual([
      "connect",
      "answer",
      "act",
      "draft",
      "open-source",
      "open-editor",
      "snapshot",
      "setting",
    ]);
    expect(Object.keys(BOARD_PROTOCOL_MESSAGES.toPage)).toEqual([
      "board",
      "state",
      "receipt",
      "discarded",
      "moved",
      "refused",
      "done",
      "draft",
      "closed",
      "source-state",
      "editor-outcome",
      "snapshot-saved",
      "snapshot-failed",
      "settings",
    ]);
  });

  test("each has its schema, in the set before E8's two, and its ID in SCHEMA_IDS by its type", () => {
    const ids = ["snapshot", "snapshot-saved", "snapshot-failed"].map(
      (type) => `urn:askboard:board-protocol:${type}`,
    );
    expect(boardProtocol.schemas.map(idOf).slice(-5, -2)).toEqual(ids);
    const byType = SCHEMA_IDS as Readonly<Record<string, string>>;
    expect([byType.snapshot, byType["snapshot-saved"], byType["snapshot-failed"]]).toEqual(ids);
  });

  test("the board protocol is at widget-registry's minor, after widget-answers'", () => {
    expect(BOARD_PROTOCOL_VERSION).toBe("1.6");
    expect(boardProtocol.version).toBe(BOARD_PROTOCOL_VERSION);
  });

  test("a request's ID is the action-ID schema's: 22 base64url characters", () => {
    const schema = boardProtocol.schemas.find(
      (candidate) => idOf(candidate) === SCHEMA_IDS.snapshot,
    );
    expect((schema as { properties: Record<string, unknown> }).properties.requestId).toEqual({
      $ref: "urn:askboard:board-protocol:act#/properties/actionId",
    });
    expect(requestId).toMatch(new RegExp(ACTION_ID_PATTERN));
  });
});

describe("the board page's snapshot request", () => {
  const request = { version, type: "snapshot", requestId };

  test("validates, with or without unsent work", () => {
    expect(validateBoardMessage("toHost", request)).toEqual({ ok: true, value: request as never });
    expect(toHost({ ...request, unsentWork: true })).toEqual([]);
  });

  test("without its ID fails, naming requestId", () => {
    const { requestId: _, ...bare } = request;
    expect(toHost(bare)).toEqual(["/requestId"]);
  });

  test.each([
    ["an ID of 21 characters", { requestId: requestId.slice(1) }, "/requestId"],
    ["an ID with a dot", { requestId: `${requestId.slice(1)}.` }, "/requestId"],
    ["unsent work said false", { unsentWork: false }, "/unsentWork"],
    ["the draft record", { record: { delivery: "submitted", questions: {} } }, "/record"],
    ["a folder of its own", { folder: "/tmp" }, "/folder"],
  ])("with %s fails, naming the field", (_, fields, field) => {
    expect(toHost({ ...request, ...fields })).toEqual([field]);
  });

  test("is no message board-host sends", () => {
    expect(toPage(request)).toEqual(["/type"]);
  });
});

describe("board-host's replies", () => {
  const saved = { version, type: "snapshot-saved", requestId, path };
  const failed = (reason: string, fields: object = {}) => ({
    version,
    type: "snapshot-failed",
    requestId,
    reason,
    ...fields,
  });

  test("snapshot-saved names the request and the file's absolute path", () => {
    expect(toPage(saved)).toEqual([]);
    expect(toPage({ ...saved, path: ".askboard/snapshots/a.html" })).toEqual(["/path"]);
    const { requestId: _, ...bare } = saved;
    expect(toPage(bare)).toEqual(["/requestId"]);
  });

  test("snapshot-failed with write-failed names the Snapshot folder", () => {
    expect(toPage(failed("write-failed", { folder }))).toEqual([]);
    expect(toPage(failed("write-failed"))).toEqual(["/folder"]);
  });

  test.each(["no-project-root", "internal-error", "discarded"])(
    "snapshot-failed with %s names no folder",
    (reason) => {
      expect(toPage(failed(reason))).toEqual([]);
      expect(toPage(failed(reason, { folder }))).toEqual(["/folder"]);
    },
  );

  test("snapshot-failed with a reason the protocol does not define fails at the reason", () => {
    expect(toPage(failed("outside-project"))).toEqual(["/reason"]);
  });

  test("neither is a message the board page sends", () => {
    expect(toHost(saved)).toEqual(["/type"]);
    expect(toHost(failed("discarded"))).toEqual(["/type"]);
  });

  test("the protocol examples hold one valid message of each type, in each direction", () => {
    const { toHost: page, toPage: host } = snapshotProtocolExamples;
    expect(page.map((message) => message.type)).toEqual(["snapshot"]);
    expect([...new Set(host.map((message) => message.type))]).toEqual([
      "snapshot-saved",
      "snapshot-failed",
    ]);
    for (const message of page) expect(toHost(message)).toEqual([]);
    for (const message of host) expect(toPage(message)).toEqual([]);
  });
});

describe("the recorded exchange", () => {
  const { steps } = snapshotTranscript;

  test("is E7's own record, beside E1's and E3's", () => {
    expect(snapshotTranscripts.snapshot).toBe(snapshotTranscript);
    expect(Object.keys(snapshotTranscripts)[0]).toBe("snapshot");
    expect([snapshotTranscript.askId, snapshotTranscript.token]).toEqual([
      LIFECYCLE.askId,
      LIFECYCLE.token,
    ]);
  });

  test("every message validates in its direction", () => {
    for (const step of steps) {
      if (!("message" in step)) continue;
      const direction = step.from === "page" ? "toHost" : "toPage";
      const checked = validateBoardMessage(direction, step.message);
      expect({ step, ok: checked.ok }).toEqual({ step, ok: true });
    }
  });

  test("the socket opens with connect, then the board and the state", () => {
    const opening = steps.slice(0, 3).map((step) => ("message" in step ? step.message.type : ""));
    expect(opening).toEqual(["connect", "board", "state"]);
  });

  test("a board's Snapshot is saved, then fails with write-failed, no-project-root and discarded", () => {
    const replies = steps
      .slice(3)
      .filter((step) => step.from === "host")
      .map((step) => ("message" in step ? step.message : undefined));
    expect(replies.map((reply) => reply?.type)).toEqual([
      "snapshot-saved",
      "snapshot-failed",
      "snapshot-failed",
      "snapshot-failed",
    ]);
    const reasons = replies.map((reply) =>
      reply !== undefined && "reason" in reply ? reply.reason : undefined,
    );
    expect(reasons).toEqual([undefined, "write-failed", "no-project-root", "discarded"]);
  });

  test("each request gets one reply naming its fresh ID, and nothing else follows it", () => {
    const exchange = steps.slice(3);
    expect(exchange.map((step) => step.from)).toEqual([
      "page",
      "host",
      "page",
      "host",
      "page",
      "host",
      "page",
      "host",
    ]);
    const idOfStep = (step: (typeof exchange)[number]) =>
      "message" in step && "requestId" in step.message ? step.message.requestId : undefined;
    const ids = exchange.map(idOfStep);
    for (let at = 0; at < ids.length; at += 2) expect(ids[at + 1]).toBe(ids[at] as string);
    const requests = ids.filter((_, at) => at % 2 === 0);
    expect(new Set(requests).size).toBe(requests.length);
  });

  test("holds no draft record and no board link", () => {
    const text = JSON.stringify(snapshotTranscript.steps.slice(3));
    expect(text).not.toContain('"record"');
    expect(text).not.toContain(`/b/${LIFECYCLE.askId}`);
  });
});
