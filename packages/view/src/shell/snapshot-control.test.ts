import { describe, expect, test } from "bun:test";
import { UNSENT_WORK_NOTE } from "../snapshot-line.ts";
import type { SnapshotFeedback, ViewMessage, ViewUpdate } from "../view-protocol.ts";
import type { ViewChannel } from "./channel.ts";
import {
  createSnapshotControl,
  type SnapshotControlState,
  snapshotLineOf,
  snapshotOfferOf,
} from "./snapshot-control.ts";

const REQUEST = "dQ7rU2nVx5LpS8wKa3fYgC";
const PATH = "/home/sara/shop/.askboard/snapshots/a-20261031T143500Z-p2w8d4.html";
const FOLDER = "/home/sara/shop/.askboard/snapshots";

type Reply = Record<string, unknown> | undefined | Error;

// A channel whose replies the test gives in order, and whose updates it sends.
const fakeChannel = (...replies: Reply[]) => {
  const sent: ViewMessage[] = [];
  const listeners = new Set<(update: ViewUpdate) => void>();
  const pending: Array<() => void> = [];
  const channel: ViewChannel = {
    send: (message) => {
      sent.push(message);
      const reply = replies.shift();
      return new Promise((resolve, reject) => {
        pending.push(() => (reply instanceof Error ? reject(reply) : resolve(reply)));
      });
    },
    onUpdate: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onTheme: () => () => {},
  };
  const update = (snapshot?: SnapshotFeedback) => {
    for (const listener of listeners) {
      listener({
        type: "state",
        state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
        ...{ snapshot },
      });
    }
  };
  // Lets the oldest reply reach the control.
  const answer = async () => {
    pending.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
  };
  return { channel, sent, update, answer };
};

const saved: SnapshotFeedback = { requestId: REQUEST, outcome: "saved", path: PATH };

describe("the bar's Snapshot (snapshot task 7.1)", () => {
  test("a press sends one snapshot message; the reply's ID waits for its feedback", async () => {
    const fake = fakeChannel({ outcome: "sent", requestId: REQUEST });
    const control = createSnapshotControl(fake.channel);
    expect(control.get()).toEqual({ phase: "idle" });
    control.take();
    control.take();
    expect(fake.sent).toEqual([{ type: "snapshot" }]);
    await fake.answer();
    expect(control.get()).toEqual({ phase: "taking", requestId: REQUEST, unsentWork: false });
    control.take();
    expect(fake.sent).toHaveLength(1);
    fake.update({ ...saved, requestId: "eR4sV9oWy6MqT1xLb5gZhD" });
    expect(control.get().phase).toBe("taking");
    fake.update(saved);
    expect(control.get()).toEqual({ phase: "ended", feedback: saved });
  });

  test("feedback heard before the reply ends the request once the reply names it", async () => {
    const fake = fakeChannel({ outcome: "sent", requestId: REQUEST, unsentWork: true });
    const control = createSnapshotControl(fake.channel);
    control.take();
    fake.update();
    fake.update({ ...saved, unsentWork: true });
    await fake.answer();
    expect(control.get()).toEqual({ phase: "ended", feedback: { ...saved, unsentWork: true } });
  });

  test("a second Snapshot can follow the first once it ended", async () => {
    const second = "eR4sV9oWy6MqT1xLb5gZhD";
    const fake = fakeChannel(
      { outcome: "sent", requestId: REQUEST },
      { outcome: "sent", requestId: second, unsentWork: true },
    );
    const control = createSnapshotControl(fake.channel);
    control.take();
    await fake.answer();
    fake.update(saved);
    control.take();
    await fake.answer();
    // The first request's feedback, repeated in later updates, does not end the second.
    fake.update(saved);
    expect(control.get()).toEqual({ phase: "taking", requestId: second, unsentWork: true });
  });

  test("a refusal, an unreadable reply and a failed send each end it refused", async () => {
    const fake = fakeChannel(
      { outcome: "refused", detail: "the connection is lost" },
      { outcome: "maybe" },
      new Error("the view message was refused"),
    );
    const control = createSnapshotControl(fake.channel);
    const states: SnapshotControlState[] = [];
    for (let n = 0; n < 3; n += 1) {
      control.take();
      await fake.answer();
      states.push(control.get());
    }
    expect(states).toEqual([
      { phase: "refused", detail: "the connection is lost" },
      { phase: "refused", detail: "the board page did not take the request" },
      { phase: "refused", detail: "the view message was refused" },
    ]);
    expect(fake.sent).toHaveLength(3);
  });
});

describe("the bar's Snapshot line", () => {
  const ended = (feedback: SnapshotFeedback) => snapshotLineOf({ phase: "ended", feedback });

  test("nothing before a press; the note while taking with unsent work", () => {
    expect(snapshotLineOf({ phase: "idle" })).toBeUndefined();
    expect(snapshotLineOf({ phase: "taking", requestId: REQUEST, unsentWork: true })).toEqual({
      note: UNSENT_WORK_NOTE,
      text: "Taking the Snapshot…",
      failed: false,
    });
  });

  test("the saved path, and the folder of a failed write, in code type", () => {
    expect(ended({ ...saved, unsentWork: true })).toEqual({
      note: UNSENT_WORK_NOTE,
      text: "Snapshot saved:",
      code: PATH,
      failed: false,
    });
    expect(
      ended({ requestId: REQUEST, outcome: "failed", reason: "write-failed", folder: FOLDER }),
    ).toEqual({
      text: "No Snapshot was taken: it could not be written in",
      code: FOLDER,
      failed: true,
    });
  });

  test("each other failure in words, with no folder", () => {
    const line = (reason: "no-project-root" | "internal-error" | "discarded" | "unconfirmed") =>
      ended({ requestId: REQUEST, outcome: "failed", reason });
    expect(line("no-project-root")?.text).toContain("CLAUDE_PROJECT_DIR");
    expect(line("internal-error")?.text).toBe("No Snapshot was taken: AskBoard failed to take it.");
    expect(line("discarded")?.text).toBe("No Snapshot was taken: the ask was discarded.");
    expect(line("unconfirmed")?.text).toStartWith("The Snapshot was not confirmed");
    expect(line("unconfirmed")?.text).not.toContain("No Snapshot was taken");
    for (const reason of [
      "no-project-root",
      "internal-error",
      "discarded",
      "unconfirmed",
    ] as const) {
      expect(line(reason)?.code).toBeUndefined();
      expect(line(reason)?.failed).toBe(true);
    }
  });

  test("a refusal says why", () => {
    expect(snapshotLineOf({ phase: "refused", detail: "the ask was discarded" })).toEqual({
      text: "No Snapshot was taken: the ask was discarded.",
      failed: true,
    });
  });
});

describe("whether the board offers the Snapshot", () => {
  test("hidden once discarded, disabled while lost or moved, offered open or closed", () => {
    expect(snapshotOfferOf("discarded", undefined)).toBe("hidden");
    expect(snapshotOfferOf("discarded", "lost")).toBe("hidden");
    expect(snapshotOfferOf("moved", undefined)).toBe("disabled");
    expect(snapshotOfferOf(undefined, "lost")).toBe("disabled");
    expect(snapshotOfferOf("closed", "lost")).toBe("disabled");
    expect(snapshotOfferOf("closed", undefined)).toBe("enabled");
    expect(snapshotOfferOf(undefined, undefined)).toBe("enabled");
  });
});
