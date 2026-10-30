// The board listener's port (design decision 5): `127.0.0.1` only, the first free port of the range
// (AD-2, AD-11). Session processes share the range, so a taken port is the next session's cue to
// try the following one.

import type { Server } from "node:http";
import { BOARD_HOST } from "@askboard/contract";

export type PortRange = { readonly first: number; readonly last: number };

/** No port of the range was free. */
export class NoFreePortError extends Error {
  override readonly name = "NoFreePortError";
  readonly code = "NO_FREE_PORT";
  constructor(range: PortRange) {
    super(`no free port in ${range.first}-${range.last} on ${BOARD_HOST}`);
  }
}

const listenOn = (server: Server, port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const failed = (error: Error) => reject(error);
    server.once("error", failed);
    server.listen({ port, host: BOARD_HOST, exclusive: true }, () => {
      server.off("error", failed);
      resolve();
    });
  });

const inUse = (error: unknown): boolean =>
  error instanceof Error && (error as { code?: unknown }).code === "EADDRINUSE";

/** Listens on the first free port of the range and returns it; any failure but a taken port throws. */
export const listen = async (server: Server, range: PortRange): Promise<number> => {
  for (let port = range.first; port <= range.last; port += 1) {
    try {
      await listenOn(server, port);
      return port;
    } catch (error) {
      if (!inUse(error)) throw error;
    }
  }
  throw new NoFreePortError(range);
};

/** Stops listening and ends every connection the server still holds. */
export const stop = (server: Server): Promise<void> =>
  new Promise((resolve) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close(() => resolve());
    server.closeAllConnections();
  });
