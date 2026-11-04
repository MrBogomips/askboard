import { describe, expect, test } from "bun:test";
import {
  closedAskSnapshotTranscript,
  discardSnapshotTranscript,
  LIFECYCLE,
  type SnapshotTranscript,
  type SnapshotTranscriptStep,
  snapshotTranscript,
  snapshotTranscripts,
  takeoverSnapshotTranscript,
} from "../src/fixtures/index.ts";
import { ACTION_ID_PATTERN, BOARD_CLOSE_CODES } from "../src/index.ts";
import { validateBoardMessage } from "../src/validate.ts";

// The board-host side of a board's Snapshot, recorded after task 1.3's exchange (snapshot task
// 6.1; board-host spec, A Snapshot requested by the board, A board's Snapshot that fails): a closed
// ask's Snapshot, a takeover's and a discard while a Snapshot is taken.

const what = (step: SnapshotTranscriptStep): string => {
  if ("message" in step) return `${step.socket} ${step.from} ${step.message.type}`;
  if ("close" in step) return `${step.socket} close ${step.close}`;
  if (step.from === "session") return `session ${step.event}`;
  return `${step.socket} ${step.from}`;
};

const requestIdOf = (step: SnapshotTranscriptStep): string | undefined =>
  "message" in step && "requestId" in step.message ? step.message.requestId : undefined;

const exchanges: Readonly<Record<string, SnapshotTranscript>> = {
  closedAsk: closedAskSnapshotTranscript,
  takeover: takeoverSnapshotTranscript,
  discardMeanwhile: discardSnapshotTranscript,
};

describe("the board-host exchanges", () => {
  test("follow task 1.3's in E7's record, on the lifecycle ask", () => {
    expect(snapshotTranscripts).toEqual({ snapshot: snapshotTranscript, ...exchanges });
    for (const exchange of Object.values(exchanges)) {
      expect([exchange.askId, exchange.token]).toEqual([LIFECYCLE.askId, LIFECYCLE.token]);
    }
  });

  test.each(Object.entries(exchanges))(
    "%s: every message validates in its direction",
    (_, exchange) => {
      for (const step of exchange.steps) {
        if (!("message" in step)) continue;
        const direction = step.from === "page" ? "toHost" : "toPage";
        expect({ step, ok: validateBoardMessage(direction, step.message).ok }).toEqual({
          step,
          ok: true,
        });
      }
    },
  );

  test("the request IDs are fresh across E7's exchanges, each an action ID", () => {
    const requests = Object.values(snapshotTranscripts).flatMap((exchange) =>
      exchange.steps
        .filter((step) => step.from === "page")
        .flatMap((step) => requestIdOf(step) ?? []),
    );
    expect(new Set(requests).size).toBe(requests.length);
    for (const id of requests) expect(id).toMatch(new RegExp(ACTION_ID_PATTERN));
  });

  test("a closed ask's Snapshot is saved after the close", () => {
    expect(closedAskSnapshotTranscript.steps.map(what)).toEqual([
      "1 page connect",
      "1 host board",
      "1 host state",
      "session update",
      "1 host closed",
      "1 page snapshot",
      "1 host snapshot-saved",
    ]);
    const [request, reply] = closedAskSnapshotTranscript.steps.slice(-2).map(requestIdOf);
    expect(reply).toBe(request as string);
  });

  test("across a takeover, only the live tab's request is answered, and with its unsent work", () => {
    const { steps } = takeoverSnapshotTranscript;
    expect(steps.map(what)).toEqual([
      "1 page connect",
      "1 host board",
      "1 host state",
      "2 page connect",
      "1 host moved",
      "1 page snapshot",
      "1 page draft",
      `1 close ${BOARD_CLOSE_CODES.moved}`,
      "2 host board",
      "2 host state",
      "2 host draft",
      "2 page snapshot",
      "2 host snapshot-saved",
    ]);
    const ids = steps.map(requestIdOf);
    const [moved, live, reply] = ids.filter((id) => id !== undefined);
    expect(reply).toBe(live as string);
    expect(ids.filter((id) => id === moved)).toHaveLength(1);
    const asked = steps.at(-2);
    expect(asked !== undefined && "message" in asked && asked.message).toMatchObject({
      unsentWork: true,
    });
  });

  test("a discard while a Snapshot is taken answers discarded before the discard", () => {
    expect(discardSnapshotTranscript.steps.map(what)).toEqual([
      "1 page connect",
      "1 host board",
      "1 host state",
      "1 page snapshot",
      "session exit",
      "1 host snapshot-failed",
      "1 host discarded",
      `1 close ${BOARD_CLOSE_CODES.discarded}`,
    ]);
    const reply = discardSnapshotTranscript.steps[5];
    expect(reply !== undefined && "message" in reply && reply.message).toMatchObject({
      reason: "discarded",
      requestId: requestIdOf(discardSnapshotTranscript.steps[3] as SnapshotTranscriptStep),
    });
  });

  test("hold no draft record in a Snapshot message and no board link", () => {
    for (const exchange of Object.values(exchanges)) {
      const messages = exchange.steps.flatMap((step) =>
        "message" in step && step.message.type.startsWith("snapshot") ? [step.message] : [],
      );
      expect(JSON.stringify(messages)).not.toContain('"record"');
      expect(JSON.stringify(exchange.steps)).not.toContain(`/b/${LIFECYCLE.askId}`);
    }
  });
});
