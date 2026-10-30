import { describe, expect, mock, test } from "bun:test";
import type { HostMessage } from "@askboard/contract";
import { PLAIN_CHOICE, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { boardLinkOf, connectBoard, type SocketLike, tokenState } from "./socket.ts";

type SocketEvent = { data?: unknown; code?: number };

class FakeSocket implements SocketLike {
  static readonly opened: FakeSocket[] = [];
  readonly sent: string[] = [];
  readyState = 0;
  closed = false;
  readonly #listeners = new Map<string, ((event: SocketEvent) => void)[]>();

  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
  }

  addEventListener(type: string, listener: (event: SocketEvent) => void): void {
    this.#listeners.set(type, [...(this.#listeners.get(type) ?? []), listener]);
  }

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, event: SocketEvent = {}): void {
    if (type === "open") this.readyState = 1;
    if (type === "close") this.readyState = 3;
    for (const listener of this.#listeners.get(type) ?? []) listener(event);
  }
}

const location = new URL(PLAIN_CHOICE.link);
const bare = new URL(`http://127.0.0.1:${PLAIN_CHOICE.port}/b/${PLAIN_CHOICE.askId}`);
const link = { askId: PLAIN_CHOICE.askId, token: PLAIN_CHOICE.token };
const board: HostMessage = { version: "1.0", type: "board", document: plainChoiceBoardDocument };

const open = () => {
  FakeSocket.opened.length = 0;
  const onMessage = mock((_message: HostMessage) => {});
  const onInvalid = mock((_problems: readonly { path: string; message: string }[]) => {});
  const onClose = mock((_code: number) => {});
  const connection = connectBoard(bare, link, { onMessage, onInvalid, onClose }, FakeSocket);
  return { connection, socket: FakeSocket.opened[0], onMessage, onInvalid, onClose };
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

  test("reports the close with its code, once; a close without one counts as a drop (1006)", () => {
    const { socket, onClose } = open();
    socket?.emit("open");
    socket?.emit("close", { code: 4409 });
    socket?.emit("close", { code: 1000 });
    expect(onClose.mock.calls).toEqual([[4409]]);
    const other = open();
    other.socket?.emit("close", {});
    expect(other.onClose.mock.calls).toEqual([[1006]]);
  });

  test("sends nothing once closed, and closes the socket when asked", () => {
    const { connection, socket } = open();
    socket?.emit("open");
    connection?.close();
    expect(socket?.closed).toBe(true);
    socket?.emit("close", { code: 1005 });
    expect(connection?.send({ version: "1.0", type: "connect", token: "x" })).toBe(false);
  });

  test("a socket the browser will not create counts as a drop, reported after the call", async () => {
    const onClose = mock((_code: number) => {});
    class Refusing extends FakeSocket {
      constructor(url: string) {
        super(url);
        throw new SyntaxError("blocked");
      }
    }
    const connection = connectBoard(
      bare,
      link,
      { onMessage: () => {}, onInvalid: () => {}, onClose },
      Refusing,
    );
    expect(onClose).not.toHaveBeenCalled();
    await Bun.sleep(0);
    expect(onClose.mock.calls).toEqual([[1006]]);
    expect(connection?.send({ version: "1.0", type: "connect", token: "x" })).toBe(false);
    connection?.close();
  });

  test("the token comes from the link's query, or from the history entry a reload keeps (AD-8)", () => {
    expect(boardLinkOf(location, null)).toEqual(link);
    expect(boardLinkOf(bare, tokenState(link))).toEqual(link);
    expect(boardLinkOf(location, { token: "other" })).toEqual(link);
    expect(tokenState(link)).toEqual({ token: PLAIN_CHOICE.token });
  });

  test("a page that is no board link, or has no token, is no board", () => {
    for (const state of [undefined, null, {}, { token: 7 }, { token: "" }, "token"]) {
      expect(boardLinkOf(bare, state)).toBeUndefined();
    }
    const manifest = new URL(`http://127.0.0.1:${PLAIN_CHOICE.port}/m?t=${PLAIN_CHOICE.token}`);
    expect(boardLinkOf(manifest, tokenState(link))).toBeUndefined();
  });
});
