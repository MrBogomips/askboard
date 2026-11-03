// The local API (design decisions 2 and 3; AD-2, AD-5, AD-11): HTTP on `node:http` over a Unix
// socket in the contract's session folder, never on a network interface, behind the session token,
// and the session file through which the hooks and the mod find it. It starts at the session
// process's first request other than `server/discover`; when it cannot, the session runs on pull
// alone and says why once. Each starter listens on a socket of its own, claims the session file
// once that socket is ready, and only the one that holds the file moves its socket to the
// socket's name; so two session processes starting together never both believe they hold the
// file, neither touches the other's socket, and no reader finds the file before its socket. It
// closes after the discard at exit, removing the file and the socket while the file is still this
// process's.

import { randomBytes } from "node:crypto";
import { chmodSync, renameSync } from "node:fs";
import { createServer, type Server } from "node:http";
import {
  type AskingRule,
  SESSION_FILE_FORMAT,
  SESSION_TOKEN_BYTES,
  type SessionEnvironment,
  type SessionFile,
  sessionFilePath,
  sessionFolder,
  socketPathFor,
  socketPathProblem,
} from "@askboard/contract";
import { validateSessionFile } from "@askboard/contract/validate";
import { stop } from "../listener.ts";
import { handleLocalRequest } from "./http.ts";
import type { RecordTable } from "./records.ts";
import { createHandlers, type RoutesCore } from "./routes.ts";
import {
  claimSessionFile,
  isAlive,
  prepareFolder,
  pruneFolder,
  removeIfHeld,
} from "./session-file.ts";

export { REQUEST_MAX_BYTES } from "./http.ts";
export { createOrigins, labelOf, type OriginOf, type OriginOptions, type Run } from "./origin.ts";
export { PENDING_MAX_BYTES, UNCHECKED_LABEL } from "./poll.ts";
export { RecordTable, type RecordTableOptions } from "./records.ts";
export type { RoutesCore } from "./routes.ts";
export {
  type ParentArgv,
  type ParentArgvOptions,
  parentTeammate,
  readParentArgv,
} from "./teammate.ts";

/** A new session token: 128 random bits as 22 base64url characters (AD-11). */
export const newSessionToken = (): string => randomBytes(SESSION_TOKEN_BYTES).toString("base64url");

export type LocalApiOptions = {
  /** ask-core, read at the start: ask-core takes the record table when it is made. */
  readonly core: () => RoutesCore;
  readonly records: RecordTable;
  /** The variables the session folder depends on (`XDG_RUNTIME_DIR`, `TMPDIR`). */
  readonly env: SessionEnvironment;
  readonly uid: number;
  /** The Claude Code process's PID, the session process's parent: it names the file and socket. */
  readonly key: number;
  /** This process's PID, which the session file names. */
  readonly pid: number;
  /** `process.platform`, for the socket path's limit. */
  readonly platform: string;
  /**
   * The session project root, the real path of `CLAUDE_PROJECT_DIR`, which the session file names;
   * absent when the session has none (AD-12).
   */
  readonly projectRoot?: string;
  /** Whether a board can be shown, by AD-18's rule: the notifier's check. */
  readonly showable: () => Promise<boolean>;
  /** The asking rule in effect (E8's seam); `none` without it (AD-16). */
  readonly rule?: () => AskingRule;
  /** Where a failure no caller can take goes, such as a start that failed. */
  readonly report: (error: unknown) => void;
  /** AskBoard's own fixed text for stderr. */
  readonly diagnose: (text: string) => void;
  /** Makes the session token; 16 random bytes in base64url by default. */
  readonly token?: () => string;
  /** Whether a process exists; `kill(pid, 0)` by default. */
  readonly alive?: (pid: number) => boolean;
};

export type LocalApi = {
  /**
   * Starts the local API and writes the session file, once; resolves when it listens or when the
   * session is left on pull. Never rejects.
   */
  start(): Promise<void>;
  /**
   * Closes the listener, then removes the session file and socket while the file is still this
   * process's. Never rejects.
   */
  close(): Promise<void>;
};

type Running = { readonly server: Server; readonly file: string; readonly socket: string };

/**
 * Where a starter listens before it holds the session file: `<key>.` and four random hexadecimal
 * digits in place of `sock`, so the path is no longer than the socket's.
 */
const startingSocketPath = (socket: string): string =>
  `${socket.slice(0, -"sock".length)}${randomBytes(2).toString("hex")}`;

/**
 * Listens on the socket, created under a 077 umask, since Bun and Node make it from the umask, then
 * set to 0600 explicitly (spike, Linux harness).
 */
const listenOnSocket = (server: Server, path: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const previous = process.umask(0o077);
    const settled = () => {
      process.umask(previous);
      server.off("error", failed);
      server.off("listening", listened);
    };
    const failed = (error: Error) => {
      settled();
      reject(error);
    };
    const listened = () => {
      settled();
      try {
        chmodSync(path, 0o600);
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    server.once("error", failed);
    server.once("listening", listened);
    server.listen(path);
  });

export const createLocalApi = (options: LocalApiOptions): LocalApi => {
  const { env, uid, key, pid, report, diagnose } = options;
  const alive = options.alive ?? isAlive;
  let starting: Promise<Running | undefined> | undefined;
  let closed = false;

  const pullAlone = (why: string): undefined => {
    diagnose(`the local API is off, so this session runs on pull alone: ${why}`);
    return undefined;
  };

  const begin = async (): Promise<Running | undefined> => {
    const folder = sessionFolder({ env, uid });
    const file = sessionFilePath(folder, key);
    const socket = socketPathFor(folder, key);
    const tooLong = socketPathProblem(socket, options.platform);
    if (tooLong !== undefined) return pullAlone(tooLong);
    const unusable = prepareFolder(folder, uid);
    if (unusable !== undefined) return pullAlone(unusable);
    pruneFolder(folder, key, alive);
    const core = options.core();
    const token = (options.token ?? newSessionToken)();
    const session: SessionFile = {
      format: SESSION_FILE_FORMAT,
      key,
      pid,
      epoch: core.epoch,
      apiAddress: socket,
      sessionToken: token,
      ...(options.projectRoot === undefined ? {} : { projectDir: options.projectRoot }),
      startedAt: new Date().toISOString(),
    };
    if (!validateSessionFile(session).ok) {
      return pullAlone("the session file it would write is not valid");
    }
    return serve(core, session, file);
  };

  // Listens on a starting socket, then claims the session file; the holder moves its socket to the
  // socket's name, and any other closes its own and runs on pull.
  const serve = async (
    core: RoutesCore,
    session: SessionFile,
    file: string,
  ): Promise<Running | undefined> => {
    const { sessionToken: token, apiAddress: socket } = session;
    const handlers = createHandlers({
      core,
      records: options.records,
      showable: options.showable,
      ...(options.rule === undefined ? {} : { rule: options.rule }),
    });
    const deps = { token, handlers, diagnose, report };
    const server = createServer((request, response) => {
      void handleLocalRequest(deps, request, response);
    });
    const listening = startingSocketPath(socket);
    try {
      await listenOnSocket(server, listening);
    } catch (error) {
      await stop(server);
      throw error;
    }
    // A failure of the listening server, such as on accepting a connection, is reported: with no
    // listener it would end the session process.
    server.on("error", report);
    let held = false;
    try {
      held = !closed && claimSessionFile(file, session, alive);
      // The holder alone puts its socket in place, over one a gone session process left.
      if (held) renameSync(listening, socket);
    } catch (error) {
      await stop(server);
      if (held) removeIfHeld(file, pid);
      throw error;
    }
    if (held) return { server, file, socket };
    await stop(server);
    if (closed) return undefined;
    return pullAlone(
      "another AskBoard session process of this Claude Code session holds its session file",
    );
  };

  // Closes the listener, then removes the file and the socket while the file is still this
  // process's. Closing the listener unlinks the path it listened on, the starting socket's, which
  // the move to the socket's name has emptied.
  const release = async ({ server, file, socket }: Running): Promise<void> => {
    await stop(server);
    removeIfHeld(file, pid, socket);
  };

  return {
    start: async () => {
      if (closed) return;
      starting ??= begin().catch((error: unknown) => {
        report(error);
        return undefined;
      });
      await starting;
    },
    close: async () => {
      closed = true;
      const running = await starting;
      if (running === undefined) return;
      try {
        // A file that names another process is that one's, and stays with its socket.
        await release(running);
      } catch (error) {
        report(error);
      }
    },
  };
};
