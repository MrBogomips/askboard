// board-host: each ask's board on the local machine only, behind its own token (AD-8, AD-11), and
// the board protocol between the board page and ask-core (AD-3, AD-21), at 1.1 for the ask
// lifecycle (ask-lifecycle, design decision 5). It imports only ask-core and the contract (AD-1).
// The listener opens at the first link ask-core asks for (AD-2). Beside it, in `local-api/`, the
// local API for the hooks and the mod and its session file (push delivery, AD-5), on a listener of
// its own: neither token reaches the other's routes.

import { createServer, type Server } from "node:http";
import { BOARD_PORT_RANGE, boardLink } from "@askboard/contract";
import type { AskCore, BoardAddress } from "@askboard/core";
import { type ServerOptions, WebSocketServer } from "ws";
import {
  Boards,
  CLOSE_GRACE_MS,
  type EditorCommand,
  MESSAGE_MAX_BYTES,
  type SocketLimits,
} from "./boards.ts";
import { handleRequest, handleUpgrade } from "./http.ts";
import { listen, type PortRange, stop } from "./listener.ts";
import { BoardTokens, newToken } from "./tokens.ts";
import { loadView } from "./view.ts";

/** E1's part of ask-core: the board's answers and the subscription. */
export type E1Core = Pick<AskCore, "answer" | "subscribe">;

/**
 * The ask lifecycle's part: what the board shows, the board's act commands, the draft record and
 * the board's connections (ask-lifecycle).
 */
export type LifecycleCore = Pick<
  AskCore,
  "lifecycleBoard" | "act" | "holdDraft" | "draftToRestore" | "connected" | "disconnected"
>;

/**
 * Push delivery's part, optional: `setWorking` hears each board's working signal, and `whoAsked`
 * and `agentStatus` give the context header's data; without them a presence message changes
 * nothing and no header message is sent.
 */
export type PushCore = Partial<Pick<AskCore, "setWorking" | "whoAsked" | "agentStatus">>;

/**
 * Context's part, optional (excerpts, design decision 4): an item's source for the reading panel
 * and the source view, and the editor target; without them no item has a source.
 */
export type ContextCore = Partial<Pick<AskCore, "sourceOf" | "editorTarget">>;

/** The part of ask-core `board-host` uses: one part per change, so each change adds its own. */
export type HostCore = E1Core & LifecycleCore & PushCore & ContextCore;

export type BoardHostOptions = {
  /** ask-core, read at the first link: ask-core takes this host's address when it is made. */
  readonly core: () => HostCore;
  /** The view build's folder, holding its manifest (design decision 7). */
  readonly view: string;
  /** Where a failure no caller can take goes, such as a socket handler that threw. */
  readonly report: (error: unknown) => void;
  /** The ports to try, in order; the contract's range by default. */
  readonly ports?: PortRange;
  /** Makes a board token; 16 random bytes in base64url by default. */
  readonly token?: () => string;
  /** Bounds on sockets that have not sent their first message; `boards.ts`'s constants by default. */
  readonly limits?: Partial<SocketLimits>;
  /**
   * The session project's root (design decision 12): with it, each board receives who asked and
   * where and the agent status after its board document and state on each connect, and the agent
   * status on each change. Without it, as in E1, neither is sent.
   */
  readonly projectDir?: string;
  /**
   * The editor command, an argument vector, read at each use (excerpts, design decision 5): none
   * until configuration supplies one (E8), and then "Open in editor" starts nothing.
   */
  readonly editorCommand?: () => EditorCommand | undefined;
};

export {
  createLocalApi,
  createOrigins,
  type LocalApi,
  type LocalApiOptions,
  newSessionToken,
  type OriginOf,
  type ParentArgv,
  type ParentArgvOptions,
  parentTeammate,
  RecordTable,
  type Run,
  readParentArgv,
} from "./local-api/index.ts";

export type BoardHost = {
  /** The `BoardAddress` port ask-core holds: the first link opens the listener. */
  readonly address: BoardAddress;
  /** Closes every board socket and the listener; no link is made afterwards. */
  close(): Promise<void>;
};

/** The host could not make a link: it is closed. */
export class BoardHostClosedError extends Error {
  override readonly name = "BoardHostClosedError";
  readonly code = "BOARD_HOST_CLOSED";
}

type Running = {
  readonly port: number;
  readonly server: Server;
  readonly boards: Boards;
  readonly unsubscribe: () => void;
};

export const createBoardHost = (options: BoardHostOptions): BoardHost => {
  const tokens = new BoardTokens(options.token ?? newToken);
  const range = options.ports ?? BOARD_PORT_RANGE;
  let running: Promise<Running> | undefined;
  let closed = false;

  const start = async (): Promise<Running> => {
    const view = await loadView(options.view);
    const core = options.core();
    const boards = new Boards({
      core,
      tokens,
      report: options.report,
      ...(options.limits ? { limits: options.limits } : {}),
      ...(options.projectDir === undefined ? {} : { projectDir: options.projectDir }),
      ...(options.editorCommand === undefined ? {} : { editorCommand: options.editorCommand }),
    });
    // A live board's largest message; before `connect`, `Boards` holds a socket to far less. A close
    // handshake the peer does not finish ends the socket after `CLOSE_GRACE_MS`, not ws's 30 s:
    // ws 8.22's `closeTimeout`, which its type declarations do not name yet.
    const socketOptions: ServerOptions & { readonly closeTimeout: number } = {
      noServer: true,
      maxPayload: MESSAGE_MAX_BYTES,
      closeTimeout: CLOSE_GRACE_MS,
    };
    const sockets = new WebSocketServer(socketOptions);
    const deps = { core, tokens, view, report: options.report, closed: () => closed };
    const server = createServer((request, response) => handleRequest(deps, request, response));
    server.on("upgrade", (request, socket, head) =>
      handleUpgrade(deps, request, socket, (askId) =>
        sockets.handleUpgrade(request, socket, head, (open) => boards.attach(open, askId, socket)),
      ),
    );
    const port = await listen(server, range);
    // A failure of the listening server, such as on accepting a connection, is reported: with no
    // listener it would end the session process.
    server.on("error", options.report);
    const unsubscribe = core.subscribe((event) => boards.hear(event));
    return { port, server, boards, unsubscribe };
  };

  const address: BoardAddress = {
    link: async (askId) => {
      if (closed) throw new BoardHostClosedError("the board host is closed");
      running ??= start().catch((error: unknown) => {
        // A failed start opens nothing: the next link tries again.
        running = undefined;
        throw error;
      });
      const { port } = await running;
      if (closed) throw new BoardHostClosedError("the board host is closed");
      return boardLink({ port, askId, token: tokens.issue(askId) });
    },
  };

  const close = async (): Promise<void> => {
    closed = true;
    const started = await running?.catch(() => undefined);
    if (started === undefined) return;
    started.unsubscribe();
    await started.boards.closeAll();
    await stop(started.server);
  };

  return { address, close };
};
