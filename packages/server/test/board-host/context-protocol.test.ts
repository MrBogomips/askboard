import { afterAll, describe, expect, test } from "bun:test";
import { BOARD_PROTOCOL_VERSION, type LifecycleBoardDocument } from "@askboard/contract";
import {
  CONTEXT,
  type ContextTranscriptStep,
  contextBoardDocument,
  readingPanelTranscript,
} from "@askboard/contract/fixtures";
import { validateBoardMessage } from "@askboard/contract/validate";
import type { Source, SourceState } from "@askboard/core";
import { type BoardHostOptions, createBoardHost } from "../../src/board-host/index.ts";
import { fakeHostCore, type OpenView } from "./fake-core.ts";
import { type BoardSocket, freeRange, openSocket, removeViews, writeView } from "./helpers.ts";

// The reading panel's messages (excerpts, task 5.3; design decision 5, Messages; board-host spec,
// "Reading panel messages", "A changed excerpt"): `open-source` answered with `source-state` from
// ask-core's state of the source now, only on the ask's live socket, against a fake core.

const version = BOARD_PROTOCOL_VERSION;
const { askId, token } = CONTEXT;

afterAll(removeViews);

const contextView: OpenView = {
  askId,
  state: "waiting",
  document: contextBoardDocument as unknown as LifecycleBoardDocument,
  questions: contextBoardDocument.items.map(({ id }) => ({
    itemId: id,
    rev: 1,
    state: "open",
    thread: [],
  })),
};

// What ask-core reads of each pointer item's source now, as the transcript records it.
const STATES: Readonly<Record<string, SourceState>> = {
  "retry-adr": { status: "available", changed: false, line: 7 },
  "retry-src": { status: "available", line: 1 },
  "missing-doc": { status: "missing" },
  readme: { status: "available" },
  "old-src": { status: "outside-root" },
};

type HostOf = {
  readonly editorCommand?: BoardHostOptions["editorCommand"];
  readonly takeoverFlushMs?: number;
  /** Holds every state read until `release`. */
  readonly held?: boolean;
  readonly sourceless?: boolean;
};

const hostOf = async (options: HostOf = {}) => {
  const fake = fakeHostCore({ view: contextView });
  const read: string[] = [];
  const waiting: (() => void)[] = [];
  const sourceOf = (ask: string, itemId: string): Source | undefined => {
    const state = ask === askId ? STATES[itemId] : undefined;
    if (state === undefined) return undefined;
    return {
      path: itemId,
      state: async () => {
        read.push(itemId);
        if (options.held) await new Promise<void>((go) => waiting.push(go));
        return state;
      },
      text: async () => ({ status: "missing" }),
    };
  };
  const host = createBoardHost({
    core: () => (options.sourceless ? fake.core : { ...fake.core, sourceOf }),
    view: writeView(),
    report: () => undefined,
    ports: await freeRange(1),
    token: () => token,
    limits: { takeoverFlushMs: options.takeoverFlushMs ?? 50 },
    ...(options.editorCommand === undefined ? {} : { editorCommand: options.editorCommand }),
  });
  const port = Number(new URL(await host.address.link(askId)).port);
  // A tab that connects; one that takes the board over opens once the other is gone.
  const connect = async () => {
    const socket = await openSocket(port, askId);
    socket.send({ version, type: "connect", token });
    return socket;
  };
  const open = async () => {
    const socket = await connect();
    expect(((await socket.next()) as { type: string }).type).toBe("board");
    expect(((await socket.next()) as { type: string }).type).toBe("state");
    return socket;
  };
  const release = () => {
    for (const go of waiting.splice(0)) go();
  };
  return { host, port, connect, open, read, release };
};

const openSource = (itemId: string) => ({ version, type: "open-source", itemId });

const stateOf = async (socket: BoardSocket) => {
  const message = await socket.next();
  expect(validateBoardMessage("toPage", message).ok).toBe(true);
  return message;
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
  expect(received).toEqual(expected);
};

// The editor's steps are task 5.4's; this replay leaves them out.
const EDITOR = new Set(["open-editor", "editor-outcome"]);
const readingSteps = readingPanelTranscript.steps.filter(
  (step) => !("message" in step) || !EDITOR.has(step.message.type),
);

describe("the reading panel transcript, replayed from the board page's side", () => {
  test("board-host sends exactly the host's half", async () => {
    const { host, port } = await hostOf();
    const sockets = new Map<number, BoardSocket>();
    const socketOf = async (step: ContextTranscriptStep) => {
      const known = sockets.get(step.socket);
      if (known !== undefined) return known;
      const opened = await openSocket(port, askId);
      sockets.set(step.socket, opened);
      return opened;
    };
    try {
      for (const step of readingSteps) {
        const socket = await socketOf(step);
        if (step.from === "page") socket.send("message" in step ? step.message : step.invalid);
        else if ("message" in step) expectMessage(await socket.next(), step.message);
        else expect(await socket.closed()).toBe(step.close);
      }
      await Bun.sleep(50);
      for (const socket of sockets.values()) expect(socket.pending).toEqual([]);
    } finally {
      for (const socket of sockets.values()) socket.socket.terminate();
      await host.close();
    }
  });
});

describe("source-state", () => {
  test("editor is true only with a command set and the file available", async () => {
    const { host, open } = await hostOf({ editorCommand: () => ["code", "--goto", "{file}"] });
    const tab = await open();
    try {
      for (const [itemId, editor] of [
        ["retry-adr", true],
        ["readme", true],
        ["missing-doc", false],
        ["old-src", false],
      ] as const) {
        tab.send(openSource(itemId));
        expect(await stateOf(tab)).toMatchObject({ type: "source-state", itemId, editor });
      }
    } finally {
      tab.socket.terminate();
      await host.close();
    }
  });

  test("with no command, editor is false for an available file", async () => {
    const { host, open } = await hostOf({ editorCommand: () => undefined });
    const tab = await open();
    try {
      tab.send(openSource("retry-adr"));
      expect(await stateOf(tab)).toEqual({
        version,
        type: "source-state",
        itemId: "retry-adr",
        status: "available",
        changed: false,
        line: 7,
        editor: false,
      });
    } finally {
      tab.socket.terminate();
      await host.close();
    }
  });

  test("an item with no source, or a core without sources, is missing", async () => {
    for (const sourceless of [false, true]) {
      const { host, open, read } = await hostOf({ sourceless, editorCommand: () => ["code"] });
      const tab = await open();
      try {
        for (const itemId of ["shot", "pr", "settings-note", "nope"]) {
          tab.send(openSource(itemId));
          expect(await stateOf(tab)).toEqual({
            version,
            type: "source-state",
            itemId,
            status: "missing",
            editor: false,
          });
        }
        expect(read).toEqual([]);
      } finally {
        tab.socket.terminate();
        await host.close();
      }
    }
  });
});

describe("only the ask's live socket", () => {
  test("a socket that lost the board gets no source-state, and nothing is read", async () => {
    const { host, connect, open, read } = await hostOf({ takeoverFlushMs: 2_000 });
    const first = await open();
    try {
      const taker = await connect();
      expect(await first.next()).toEqual({ version, type: "moved" });
      first.send(openSource("retry-adr"));
      await Bun.sleep(100);
      expect(read).toEqual([]);
      expect(first.pending).toEqual([]);
      taker.socket.terminate();
    } finally {
      first.socket.terminate();
      await host.close();
    }
  });

  test("a state read when the board moves is not sent to the socket that lost it", async () => {
    const { host, connect, open, read, release } = await hostOf({
      held: true,
      takeoverFlushMs: 2_000,
    });
    const first = await open();
    try {
      first.send(openSource("retry-adr"));
      while (read.length === 0) await Bun.sleep(5);
      const taker = await connect();
      expect(await first.next()).toEqual({ version, type: "moved" });
      release();
      await Bun.sleep(100);
      expect(first.pending).toEqual([]);
      expect(taker.pending).toEqual([]);
      taker.socket.terminate();
    } finally {
      first.socket.terminate();
      await host.close();
    }
  });
});
