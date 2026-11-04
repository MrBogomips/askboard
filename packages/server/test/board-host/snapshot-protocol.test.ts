import { afterAll, describe, expect, test } from "bun:test";
import {
  BOARD_CLOSE_CODES,
  BOARD_PROTOCOL_VERSION,
  type LifecycleBoardState,
  type SnapshotData,
} from "@askboard/contract";
import {
  LIFECYCLE,
  lifecycleAsk,
  lifecycleTranscripts,
  type SnapshotTranscript,
  type SnapshotTranscriptStep,
  snapshotTranscripts,
} from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import { type AskCore, type Origin, SnapshotWriteError, type SnapshotWriter } from "@askboard/core";
import { stateOf } from "../../src/board-host/messages.ts";
import { type BoardSocket, freeRange, openSocket, removeViews, startHost } from "./helpers.ts";

// Board-host spec, A Snapshot requested by the board, A board's Snapshot that fails, Unsent work
// passed on as a fact and A board's Snapshot is no event (snapshot task 6.1): task 1.3's
// transcript and the board-host exchanges, replayed from the board page's side around the real
// ask-core, with a writer that gives each outcome the transcript records. Each Snapshot's data
// holds the state a board receives at that moment, over E3's lifecycle transcripts too (design
// decision 1, Receipts), and the origin message the board received.

const version = BOARD_PROTOCOL_VERSION;
const { askId, token } = LIFECYCLE;
const PROJECT = "/home/sara/shop";
const SNAPSHOTS = `${PROJECT}/.askboard/snapshots`;

afterAll(removeViews);

type Write = (data: SnapshotData) => Promise<{ readonly path: string }>;

/** A writer doing, for each Snapshot in turn, what `writes` says, and keeping the data it got. */
const scriptedWriter = (writes: Write[]) => {
  const written: SnapshotData[] = [];
  const writer: SnapshotWriter = {
    write: async (data) => {
      written.push(data);
      const next = writes.shift();
      if (next === undefined) throw new Error("no write scripted");
      return next(data);
    },
  };
  return { writer, written };
};

const savedAt =
  (path: string): Write =>
  async () => ({ path });

// Task 1.3's exchange ends with a request discarded while it is taken, with no step of its own:
// the replay discards the ask while the write runs, and the discard follows the reply.
const discardsInWrite = (transcript: SnapshotTranscript): boolean =>
  !transcript.steps.some((step) => step.from === "session" && step.event === "exit") &&
  transcript.steps.some(
    (step) =>
      "message" in step &&
      step.message.type === "snapshot-failed" &&
      step.message.reason === "discarded",
  );

// What a reply in the transcript says the writer did.
const writeFor = (
  step: SnapshotTranscriptStep,
  discard: () => void,
  held: Promise<void>,
): Write => {
  const message = "message" in step ? step.message : undefined;
  if (message?.type === "snapshot-saved") return savedAt(message.path);
  if (message?.type !== "snapshot-failed") throw new Error("not a Snapshot reply");
  if (message.reason === "write-failed") {
    const { folder } = message;
    return async () => {
      throw SnapshotWriteError.inFolder(folder, "EACCES");
    };
  }
  if (message.reason === "no-project-root") {
    return async () => {
      throw SnapshotWriteError.noProjectRoot();
    };
  }
  return async () => {
    discard();
    await held;
    return { path: `${SNAPSHOTS}/late.html` };
  };
};

/** Waits until `ready` holds, for at most two seconds. */
const until = async (ready: () => boolean): Promise<void> => {
  for (let waited = 0; !ready(); waited += 10) {
    if (waited > 2_000) throw new Error("timed out waiting for the writer");
    await Bun.sleep(10);
  }
};

// The state a board opening now receives, or nothing once the ask is discarded.
const stateNow = (core: AskCore): LifecycleBoardState | undefined => {
  const view = core.lifecycleBoard(askId);
  return view === undefined || view.state === "discarded" ? undefined : stateOf(view);
};

/** A request the live board sent: whether it carried unsent work, and the state then. */
type Sent = { readonly unsentWork: boolean; readonly state: LifecycleBoardState };

const replay = async (transcript: SnapshotTranscript) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writes: Write[] = [];
  const { writer, written } = scriptedWriter(writes);
  const fixture = startHost({
    ports: await freeRange(1),
    tokens: [transcript.token],
    snapshots: { writer },
  });
  const discard = () => {
    if (discardsInWrite(transcript)) fixture.core.discardAll("session-exit");
  };
  for (const step of transcript.steps) {
    if (step.from === "host" && "message" in step && step.message.type.startsWith("snapshot-")) {
      writes.push(writeFor(step, discard, held));
    }
  }
  const { port } = await fixture.ask(undefined, lifecycleAsk);
  const sockets = new Map<number, BoardSocket>();
  const moved = new Set<number>();
  // Only the live board's requests are taken: those of a tab told the board moved are not.
  const taken: Sent[] = [];
  const socketOf = async (number: number) => {
    const known = sockets.get(number);
    if (known !== undefined) return known;
    const opened = await openSocket(port, transcript.askId);
    sockets.set(number, opened);
    return opened;
  };
  try {
    for (const step of transcript.steps) {
      if (step.from === "page" && "message" in step) {
        const { message } = step;
        if (message.type === "snapshot" && !moved.has(step.socket)) {
          const state = stateNow(fixture.core);
          if (state === undefined) throw new Error("a request on a discarded ask");
          taken.push({ unsentWork: message.unsentWork === true, state });
        }
        (await socketOf(step.socket)).send(message);
      } else if (step.from === "host" && "message" in step) {
        const received = await (await socketOf(step.socket)).next();
        expect(validateBoardMessage("toPage", received).ok).toBe(true);
        expect(received).toEqual(step.message);
        if (step.message.type === "moved") moved.add(step.socket);
      } else if (step.from === "host" && "close" in step) {
        expect(await (await socketOf(step.socket)).closed()).toBe(step.close);
      } else if (step.from === "session" && (step.event === "update" || step.event === "exit")) {
        // A session step comes once ask-core has handed the live board's requests to the writer.
        await until(() => written.length === taken.length);
        if (step.event === "update") {
          expect(fixture.core.update(step.request)).toMatchObject({ kind: "updated" });
        } else {
          fixture.core.discardAll("session-exit");
        }
      } else {
        throw new Error(`a step the replay does not make: ${JSON.stringify(step)}`);
      }
    }
    if (discardsInWrite(transcript)) {
      const board = sockets.get(1) as BoardSocket;
      expect(await board.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
      expect(await board.closed()).toBe(BOARD_CLOSE_CODES.discarded);
    }
    release();
    await Bun.sleep(50);
    for (const socket of sockets.values()) expect(socket.pending).toEqual([]);
    return { reported: fixture.reported, written, taken };
  } finally {
    release();
    await fixture.host.close();
  }
};

describe("E7's transcripts, replayed from the board page's side", () => {
  for (const [name, transcript] of Object.entries(snapshotTranscripts)) {
    test(`${name}: board-host sends exactly the host's half; each Snapshot is the user's`, async () => {
      const { reported, written, taken } = await replay(transcript);
      expect(reported).toEqual([]);
      expect(written.map((data) => data.snapshot.takenBy)).toEqual(taken.map(() => "user"));
      expect(written.map((data) => "unsentWork" in data.snapshot)).toEqual(
        taken.map((sent) => sent.unsentWork),
      );
      expect(written.map((data) => data.state)).toEqual(taken.map((sent) => sent.state));
    });
  }
});

describe("a Snapshot's state is the one a board receives", () => {
  // Each E3 transcript's acts and agent changes, then a Snapshot of where they left the ask.
  for (const [name, transcript] of Object.entries(lifecycleTranscripts)) {
    test(`after ${name}`, async () => {
      const { writer, written } = scriptedWriter([savedAt(`${SNAPSHOTS}/${name}.html`)]);
      const fixture = startHost({ ports: await freeRange(1), snapshots: { writer } });
      try {
        await fixture.ask(undefined, lifecycleAsk);
        for (const step of transcript.steps) {
          if (step.from === "page" && "message" in step && step.message.type === "act") {
            fixture.core.act(askId, step.message);
          } else if (step.from === "session" && step.event === "update") {
            fixture.core.update(step.request);
          } else if (step.from === "session" && step.event === "collected") {
            const read = fixture.core.read(askId, `${fixture.core.epoch}.0`);
            if (read.kind === "events") fixture.core.markRead(askId, read.cursor);
          }
        }
        const expected = stateNow(fixture.core);
        if (expected === undefined) return;
        const outcome = await fixture.core.snapshot(askId, { takenBy: "user", unsentWork: false });
        expect(outcome.outcome).toBe("saved");
        expect(written.map((data) => data.state)).toEqual([expected]);
      } finally {
        await fixture.host.close();
      }
    });
  }
});

const ORIGIN: Origin = {
  label: "Main agent",
  cwd: `${PROJECT}/web`,
  root: PROJECT,
  directory: "web",
  branch: "main",
  worktree: "shop",
};

describe("a board's Snapshot around the real ask-core", () => {
  test("holds the origin message the board received, and a following collect returns no event", async () => {
    const path = `${SNAPSHOTS}/origin.html`;
    const { writer, written } = scriptedWriter([savedAt(path)]);
    const fixture = startHost({
      ports: await freeRange(1),
      tokens: [token],
      projectDir: PROJECT,
      push: {
        records: { bind: async () => ({ ownerKey: "owner-1", origin: ORIGIN }) },
        header: { backgroundThresholdMs: 120_000 },
      },
      snapshots: { writer, projectDir: PROJECT },
    });
    const { port } = await fixture.ask(undefined, lifecycleAsk, { tool: "ask", askIds: [askId] });
    const board = await openSocket(port, askId);
    try {
      board.send({ version, type: "connect", token });
      expect(await board.next()).toMatchObject({ type: "board" });
      const { state } = (await board.next()) as { readonly state: LifecycleBoardState };
      const origin = (await board.nextHeader()) as SnapshotData["origin"];
      const before = fixture.core.read(askId, `${fixture.core.epoch}.0`);
      board.send({ version, type: "snapshot", requestId: "lY1zC6vDf9TxA3eSi8nGpK" });
      expect(await board.next()).toEqual({
        version,
        type: "snapshot-saved",
        requestId: "lY1zC6vDf9TxA3eSi8nGpK",
        path,
      });
      expect(written.map((data) => [data.state, data.origin])).toEqual([[state, origin]]);
      expect(fixture.core.read(askId, `${fixture.core.epoch}.0`)).toEqual(before);
      await Bun.sleep(50);
      expect(board.pending).toEqual([]);
      expect(fixture.reported).toEqual([]);
    } finally {
      board.socket.terminate();
      await fixture.host.close();
    }
  });
});
