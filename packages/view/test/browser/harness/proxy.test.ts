import { afterEach, describe, expect, test } from "bun:test";
import { createServer, type Server } from "node:net";
import { BOARD_HOST } from "@askboard/contract";
import { type BoardProxy, RequestHeads, startProxy } from "./proxy.ts";

const ORIGIN_CHECKED = "origin-checked";

// A session process stand-in: answers HTTP with what it saw of Host and Origin, and echoes
// WebSocket messages, refusing an upgrade whose Origin is not `http://` plus its Host, as
// board-host's gate does (AD-11).
const upstream = () => {
  const seen: { host: string | null; origin: string | null }[] = [];
  const server = Bun.serve({
    hostname: BOARD_HOST,
    port: 0,
    fetch(request, server) {
      const host = request.headers.get("host");
      const origin = request.headers.get("origin");
      seen.push({ host, origin });
      if (request.headers.get("upgrade") === "websocket") {
        if (origin !== `http://${host}`) return new Response("refused", { status: 403 });
        return server.upgrade(request) ? undefined : new Response("no", { status: 400 });
      }
      return new Response(`${request.method} ${new URL(request.url).pathname} ${ORIGIN_CHECKED}`);
    },
    websocket: {
      message(socket, message) {
        socket.send(`echo ${String(message)}`);
      },
    },
  });
  return { server, seen, port: server.port ?? 0 };
};

const servers: { stop(force: boolean): unknown }[] = [];
const proxies: BoardProxy[] = [];
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.close();
  for (const proxy of proxies.splice(0)) await proxy.close();
  for (const server of servers.splice(0)) await server.stop(true);
});

const setUp = async () => {
  const target = upstream();
  servers.push(target.server);
  const proxy = await startProxy(target.port);
  proxies.push(proxy);
  return { target, proxy, base: `http://${BOARD_HOST}:${proxy.port}` };
};

type Closed = { code: number; wasClean: boolean };

// A board page stand-in: a WebSocket through the proxy with the Origin a page of its origin sends.
const connect = (proxy: BoardProxy) => {
  const origin = `http://${BOARD_HOST}:${proxy.port}`;
  const socket = new WebSocket(`ws://${BOARD_HOST}:${proxy.port}/ws/ask`, {
    headers: { Origin: origin },
  } as unknown as string[]);
  sockets.push(socket);
  const received: string[] = [];
  socket.addEventListener("message", (event) => received.push(String(event.data)));
  const opened = new Promise<boolean>((resolve) => {
    socket.addEventListener("open", () => resolve(true));
    socket.addEventListener("close", () => resolve(false));
  });
  const closed = new Promise<Closed>((resolve) => {
    socket.addEventListener("close", (event) =>
      resolve({ code: event.code, wasClean: event.wasClean }),
    );
  });
  return { socket, received, opened, closed };
};

const until = async (check: () => boolean) => {
  const deadline = Date.now() + 2_000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("timed out");
    await Bun.sleep(10);
  }
};

describe("startProxy", () => {
  test("forwards requests unchanged and records each as METHOD /path, without the query", async () => {
    const { target, proxy, base } = await setUp();
    const response = await fetch(`${base}/b/ask?t=secret`);
    expect(await response.text()).toBe(`GET /b/ask ${ORIGIN_CHECKED}`);
    await fetch(`${base}/m`, { method: "HEAD" });
    expect(proxy.requests()).toEqual(["GET /b/ask", "HEAD /m"]);
    // The browser makes Host and Origin from the proxy's origin, and they still agree.
    expect(target.seen[0]?.host).toBe(`${BOARD_HOST}:${proxy.port}`);
  });

  test("carries a WebSocket both ways once the session side accepts its upgrade", async () => {
    const { proxy } = await setUp();
    const page = connect(proxy);
    expect(await page.opened).toBe(true);
    page.socket.send("hello");
    await until(() => page.received.length === 1);
    expect(page.received).toEqual(["echo hello"]);
    expect(proxy.requests()).toEqual(["GET /ws/ask"]);
  });

  test("drop ends every connection with no close frame and refuses new ones until restore", async () => {
    const { proxy, base } = await setUp();
    const page = connect(proxy);
    expect(await page.opened).toBe(true);
    proxy.drop();
    expect(await page.closed).toEqual({ code: 1006, wasClean: false });
    expect(await connect(proxy).opened).toBe(false);
    await expect(fetch(`${base}/m`)).rejects.toThrow();
    proxy.restore();
    expect(await connect(proxy).opened).toBe(true);
    expect((await fetch(`${base}/m`)).status).toBe(200);
  });

  test("retarget sends new connections to another session side", async () => {
    const { proxy, base } = await setUp();
    const other = upstream();
    servers.push(other.server);
    proxy.retarget(other.port);
    await fetch(`${base}/b/ask`);
    expect(other.seen).toHaveLength(1);
  });

  test("ends the browser's connection when the session side is gone", async () => {
    const { proxy, target, base } = await setUp();
    const page = connect(proxy);
    expect(await page.opened).toBe(true);
    // Bun's server says goodbye with a close frame; a killed process would not. Either way the
    // browser's connection ends.
    await target.server.stop(true);
    expect((await page.closed).code).toBeGreaterThan(0);
    await expect(fetch(`${base}/m`)).rejects.toThrow();
  });

  test("close stops listening and may be called twice", async () => {
    const { proxy, base } = await setUp();
    await proxy.close();
    await proxy.close();
    await expect(fetch(`${base}/m`)).rejects.toThrow();
  });

  test("fails to start when it cannot listen", async () => {
    const taken: Server = createServer();
    await new Promise<void>((resolve) => taken.listen(0, BOARD_HOST, resolve));
    const address = taken.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    try {
      await expect(startProxy(1, port)).rejects.toThrow();
    } finally {
      taken.close();
    }
  });
});

describe("RequestHeads", () => {
  const read = (...chunks: string[]) => {
    const lines: string[] = [];
    const heads = new RequestHeads((line) => lines.push(line));
    for (const chunk of chunks) heads.push(Buffer.from(chunk, "latin1"));
    return lines;
  };

  test("reads request lines split across chunks, several per connection", () => {
    expect(
      read("GET /b/a?t=x HTTP/1.1\r\nHo", "st: h\r\n\r\nGET /m HTTP/1.1\r\nHost: h\r\n\r\n"),
    ).toEqual(["GET /b/a", "GET /m"]);
  });

  test("skips a body by its Content-Length, even split across chunks", () => {
    expect(
      read("POST /x HTTP/1.1\r\nContent-Length: 6\r\n\r\nab", "cd", "efGET /m HTTP/1.1\r\n\r\n"),
    ).toEqual(["POST /x", "GET /m"]);
  });

  test("stops at a WebSocket upgrade: what follows is frames", () => {
    expect(
      read(
        "GET /ws/a HTTP/1.1\r\nUpgrade: websocket\r\n\r\n",
        "GET /not-a-request HTTP/1.1\r\n\r\n",
      ),
    ).toEqual(["GET /ws/a"]);
  });

  test("stops at a chunked body, which a board page never sends", () => {
    expect(
      read("POST /x HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n", "GET /m HTTP/1.1\r\n\r\n"),
    ).toEqual(["POST /x"]);
  });
});
