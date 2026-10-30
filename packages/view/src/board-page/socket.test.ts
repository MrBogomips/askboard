import { describe, expect, mock, test } from "bun:test";
import type { HostMessage } from "@askboard/contract";
import { PLAIN_CHOICE, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { connectBoard, type SocketLike } from "./socket.ts";

class FakeSocket implements SocketLike {
  static readonly opened: FakeSocket[] = [];
  readonly sent: string[] = [];
  readyState = 0;
  readonly #listeners = new Map<string, ((event: { data?: unknown }) => void)[]>();

  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }

  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  send(text: string): void {
    this.sent.push(text);
  }

  emit(type: string, event: { data?: unknown } = {}): void {
    if (type === "open") this.readyState = 1;
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
}

const link = new URL(PLAIN_CHOICE.link);
const board: HostMessage = { version: "1.0", type: "board", document: plainChoiceBoardDocument };

const open = () => {
  FakeSocket.opened.length = 0;
  const onMessage = mock((_message: HostMessage) => {});
  const onInvalid = mock((_problems: readonly { path: string; message: string }[]) => {});
  const connection = connectBoard(link, { onMessage, onInvalid }, FakeSocket);
  return { connection, socket: FakeSocket.opened[0], onMessage, onInvalid };
};

describe("the board's WebSocket (design decision 8)", () => {
  test("opens at the ask's socket route, without the token in the URL", () => {
    const { socket } = open();
    expect(socket?.url).toBe(`ws://127.0.0.1:${PLAIN_CHOICE.port}/ws/${PLAIN_CHOICE.askId}`);
  });

  test("sends the token first, once open (AD-11)", () => {
    const { socket } = open();
    expect(socket?.sent).toEqual([]);
    socket?.emit("open");
    expect(socket?.sent.map((text) => JSON.parse(text))).toEqual([
      { version: "1.0", type: "connect", token: PLAIN_CHOICE.token },
    ]);
  });

  test("hands on each message the board protocol accepts", () => {
    const { socket, onMessage, onInvalid } = open();
    socket?.emit("message", { data: JSON.stringify(board) });
    expect(onMessage.mock.calls).toEqual([[board]]);
    expect(onInvalid).not.toHaveBeenCalled();
  });

  test("never acts on a message the board protocol refuses, and reports it (AD-10)", () => {
    const { socket, onMessage, onInvalid } = open();
    socket?.emit("message", { data: JSON.stringify({ version: "1.0", type: "draft" }) });
    expect(onMessage).not.toHaveBeenCalled();
    expect(onInvalid.mock.calls[0]?.[0][0]?.path).toBe("/type");
  });

  test("sends a page message only while open", () => {
    const { connection, socket } = open();
    const answer = { version: "1.0", type: "connect", token: "x" } as const;
    expect(connection?.send(answer)).toBe(false);
    socket?.emit("open");
    expect(connection?.send(answer)).toBe(true);
    expect(socket?.sent).toHaveLength(2);
  });

  test("a page that is no board link with a token opens no socket", () => {
    FakeSocket.opened.length = 0;
    const handlers = { onMessage: () => {}, onInvalid: () => {} };
    for (const href of [
      `http://127.0.0.1:${PLAIN_CHOICE.port}/b/${PLAIN_CHOICE.askId}`,
      `http://127.0.0.1:${PLAIN_CHOICE.port}/m?t=${PLAIN_CHOICE.token}`,
    ]) {
      expect(connectBoard(new URL(href), handlers, FakeSocket)).toBeUndefined();
    }
    expect(FakeSocket.opened).toEqual([]);
  });
});
