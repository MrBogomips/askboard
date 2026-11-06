import { afterAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import {
  type LifecycleTranscriptStep,
  UJ2_SESSION,
  uj2WidgetAnsweredState,
  widgetAnswerTranscript,
} from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import type { MoleculeSource } from "@askboard/core";
import {
  type BoardSocket,
  freeRange,
  openSocket,
  removeViews,
  startHost,
  withLanguage,
} from "./helpers.ts";

// Board-host spec, Widget answer acts and Widget answers in the board state (widget-answers, task
// 4.1): group 1's widget answer transcript, replayed from the board page's side against board-host
// around the real ask-core, with the shipped molecules, over the UJ-2 ask.

const version = BOARD_PROTOCOL_VERSION;
const { askId, token } = UJ2_SESSION;
const uj2 = await Bun.file(
  join(import.meta.dir, "../../../contract/test/fixtures/asks/uj2-wbs-gantt.json"),
).json();

afterAll(removeViews);

// The shipped definitions, read by path: board-host may not import the molecule-source unit.
const SHIPPED = join(import.meta.dir, "../../../molecules/src");
const definitions = await Promise.all(
  ["wbs-pert/wbs-pert.json", "gantt-plan/gantt-plan.json"].map((file) =>
    Bun.file(join(SHIPPED, file)).json(),
  ),
);
const molecules: MoleculeSource = {
  lookup: (molecule) => {
    const definition = definitions.find((found) => found.molecule === molecule);
    return definition === undefined
      ? { found: false, reason: "unknown-molecule", shipped: [] }
      : { found: true, definition };
  },
};

// The transcript's board holds the question `plan` alone, as the fixture's board document does.
const planAsk = () => {
  const { delivery: _, items, ...rest } = structuredClone(uj2);
  return { ...rest, items: items.filter((item: { id: string }) => item.id === "plan") };
};

// A refusal's detail is text for people: the replay checks that it is there, not its words.
const expectMessage = (received: unknown, expected: object) => {
  expect(validateBoardMessage("toPage", received).ok).toBe(true);
  if ((expected as { type?: string }).type === "refused") {
    const { detail, ...rest } = received as { detail: unknown };
    const { detail: _, ...wanted } = expected as { detail: unknown };
    expect(rest).toEqual(wanted);
    expect(typeof detail).toBe("string");
    return;
  }
  expect(received).toEqual(withLanguage(expected));
};

const started = async () => {
  const fixture = startHost({
    ports: await freeRange(1),
    tokens: [token],
    molecules,
  });
  const { port } = await fixture.ask(undefined, planAsk());
  const sockets = new Map<number, BoardSocket>();
  const socketOf = async (step: LifecycleTranscriptStep & { socket: number }) => {
    const known = sockets.get(step.socket);
    if (known !== undefined) return known;
    const opened = await openSocket(port, askId);
    sockets.set(step.socket, opened);
    return opened;
  };
  const stop = async () => {
    for (const socket of sockets.values()) socket.socket.terminate();
    await fixture.host.close();
  };
  return { fixture, port, sockets, socketOf, stop };
};

const replay = async () => {
  const run = await started();
  for (const step of widgetAnswerTranscript.steps) {
    if (step.from === "page") {
      await (await run.socketOf(step)).send("message" in step ? step.message : step.invalid);
    } else if (step.from === "host") {
      const socket = await run.socketOf(step);
      if ("message" in step) expectMessage(await socket.next(), step.message);
    } else if (step.from === "network") {
      (await run.socketOf(step)).socket.terminate();
    }
  }
  await Bun.sleep(50);
  for (const socket of run.sockets.values()) expect(socket.pending).toEqual([]);
  return run;
};

describe("the widget answer transcript, replayed from the board page's side", () => {
  test("board-host sends exactly the host's half", async () => {
    const run = await replay();
    try {
      expect(run.fixture.reported).toEqual([]);
    } finally {
      await run.stop();
    }
  });

  test("the refused act leaves the log unchanged and the accepted one logs a single answer", async () => {
    const run = await replay();
    try {
      const read = run.fixture.core.read(askId, `${run.fixture.core.epoch}.0`);
      if (read.kind !== "events") throw new Error(`read ${read.kind}`);
      expect(read.events.map((event) => event.type)).toEqual(["answer"]);
      expect((read.events[0] as { changes?: unknown[] }).changes?.length).toBeGreaterThan(0);
    } finally {
      await run.stop();
    }
  });

  test("once collected, the receipt turns delivered and a takeover's new tab gets the values", async () => {
    const run = await replay();
    try {
      const tab = await openSocket(run.port, askId);
      tab.send({ version, type: "connect", token });
      await tab.next();
      await tab.next();
      const read = run.fixture.core.read(askId, `${run.fixture.core.epoch}.0`);
      if (read.kind !== "events") throw new Error(`read ${read.kind}`);
      run.fixture.core.markRead(askId, read.cursor);
      expect(await tab.next()).toEqual({
        version,
        type: "receipt",
        itemId: "plan",
        receipt: "delivered",
      });
      const second = await openSocket(run.port, askId);
      second.send({ version, type: "connect", token });
      await second.next();
      const state = (await second.next()) as typeof uj2WidgetAnsweredState;
      const { answer } = state.state.questions[0] as {
        answer: { values: object; receipt: string };
      };
      expect(answer.receipt).toBe("delivered");
      expect(answer.values).toEqual(
        (uj2WidgetAnsweredState.state.questions[0] as { answer: { values: object } }).answer.values,
      );
      tab.socket.terminate();
      second.socket.terminate();
    } finally {
      await run.stop();
    }
  });
});
