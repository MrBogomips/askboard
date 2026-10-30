import { afterAll, describe, expect, test } from "bun:test";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import { BOARD_HOST, BOARD_PORT_RANGE } from "@askboard/contract";
import { freeRange, holdPort, release, removeViews, startHost, writeView } from "./helpers.ts";

// Board-host spec, Loopback listener (task 6.1): `127.0.0.1` only, the next port of the range when
// one is taken, and opened at the first link the core asks for (AD-2, AD-11).

afterAll(removeViews);

const otherAddress = (): string | undefined =>
  Object.values(networkInterfaces())
    .flat()
    .find((entry) => entry?.family === "IPv4" && !entry.internal)?.address;

const connects = (host: string, port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.setTimeout(1_000, () => {
      socket.destroy();
      resolve(false);
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

describe("the board listener", () => {
  test("binds 127.0.0.1 on a port of the contract's range, which the link names", async () => {
    const { host, ask } = startHost();
    try {
      const { port, link } = await ask();
      expect(port).toBeGreaterThanOrEqual(BOARD_PORT_RANGE.first);
      expect(port).toBeLessThanOrEqual(BOARD_PORT_RANGE.last);
      expect(link.startsWith(`http://${BOARD_HOST}:${port}/b/`)).toBe(true);
      expect(await connects(BOARD_HOST, port)).toBe(true);
    } finally {
      await host.close();
    }
  });

  const address = otherAddress();
  test.skipIf(address === undefined)(
    "refuses a connection on the machine's non-loopback address",
    async () => {
      const ports = await freeRange(1);
      const { host, ask } = startHost({ ports });
      try {
        const { port } = await ask();
        expect(await connects(address ?? "", port)).toBe(false);
      } finally {
        await host.close();
      }
    },
  );

  test("takes the next free port when the range's first port is taken", async () => {
    const ports = await freeRange(3);
    const blocker = await holdPort(ports.first);
    const { host, ask } = startHost({ ports });
    try {
      const { port, link } = await ask();
      expect(port).toBe(ports.first + 1);
      expect(link).toContain(`:${ports.first + 1}/`);
    } finally {
      await host.close();
      await release(blocker);
    }
  });

  test("opens nothing before the first link, and opens at it", async () => {
    const ports = await freeRange(1);
    const { host, ask } = startHost({ ports });
    try {
      // The port is still free: the host has not listened yet.
      await release(await holdPort(ports.first));
      const { port } = await ask();
      expect(port).toBe(ports.first);
    } finally {
      await host.close();
    }
  });

  test("opens one listener for links asked at once", async () => {
    const ports = await freeRange(2);
    const { host, ask } = startHost({ ports });
    try {
      const [one, two] = await Promise.all([ask("ask-one"), ask("ask-two")]);
      expect(one.port).toBe(ports.first);
      expect(two.port).toBe(ports.first);
    } finally {
      await host.close();
    }
  });

  test("fails the link when every port of the range is taken, and tries again later", async () => {
    const ports = await freeRange(2);
    const first = await holdPort(ports.first);
    const last = await holdPort(ports.last);
    const { host, core } = startHost({ ports });
    try {
      await expect(core.ask(plainChoice("taken"))).rejects.toThrow();
      expect(core.board("taken")).toBeUndefined();
      await release(last);
      const outcome = await core.ask(plainChoice("taken"));
      expect(outcome.kind).toBe("created");
    } finally {
      await host.close();
      await release(first);
    }
  });

  test("fails the link when the view build is missing, creating no ask", async () => {
    const ports = await freeRange(1);
    const { host, core } = startHost({ ports, view: writeView({}) });
    try {
      await expect(core.ask(plainChoice("no-view"))).rejects.toThrow();
      expect(core.board("no-view")).toBeUndefined();
      // Nothing listens either.
      await release(await holdPort(ports.first));
    } finally {
      await host.close();
    }
  });

  test("closes its listener, and makes no link once closed", async () => {
    const ports = await freeRange(1);
    const { host, ask, core } = startHost({ ports });
    const { port } = await ask();
    await host.close();
    expect(await connects(BOARD_HOST, port)).toBe(false);
    await expect(core.ask(plainChoice("after-close"))).rejects.toThrow();
    await host.close();
  });

  test("closes at once when it never opened", async () => {
    const { host } = startHost();
    await host.close();
  });
});

const plainChoice = (askId: string) => ({
  askId,
  items: [
    {
      type: "question",
      id: "database",
      props: { text: "Which database?", options: [{ label: "PostgreSQL" }, { label: "SQLite" }] },
    },
  ],
});
