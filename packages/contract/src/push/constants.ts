// Values that the session process, the hooks and the mod share for push delivery (contract spec,
// Push delivery constants; design decisions 1 and 2). No unit defines its own.

/** How often the mod polls the local API (AD-5; open question 5). */
export const POLL_INTERVAL_MS = 1_000;

/**
 * How long an agent record waits for a call without a `tool_use_id`, which the next-call fallback
 * binds. Long enough for a slow hook, short enough that a stale record cannot bind a later call
 * (the spine's Deferred row). A call carrying the record's `tool_use_id` binds it whatever its age.
 */
export const RECORD_TIMEOUT_MS = 10_000;

/**
 * How long an unbound agent record is held for the call carrying its `tool_use_id`: `PreToolUse`
 * runs before Claude Code's permission prompt, and the user may take minutes to approve.
 */
export const RECORD_HOLD_MS = 30 * 60 * 1000;

/** The most unbound agent records held at once; the oldest is dropped first. */
export const RECORDS_HELD_MAX = 1_000;

/** The oldest Claude Code version AskBoard accepts asks from (AD-18). */
export const CLAUDE_CODE_MINIMUM = "2.1.311";

/**
 * The client name Claude Code gives in the protocol's client information, and the mod in its
 * hello: only a client of this name has its version checked against the minimum (AD-18).
 */
export const CLAUDE_CODE_CLIENT_NAME = "claude-code";

/** The largest local API response body; a longer poll is paged (AD-5). */
export const LOCAL_API_MAX_BYTES = 1024 * 1024;

/** How long a hook waits for the local API, inside the 5 s every hook declares (AD-19). */
export const HOOK_REQUEST_TIMEOUT_MS = 2_000;

/**
 * The longest teammate name a turn report carries (design decision 4, Origin, plan B), as the
 * contract bounds an agent ID: the mod cuts a longer one.
 */
export const TEAMMATE_NAME_MAX_CHARS = 256;

/** A board is working while it has focus and had a user input within this window (AD-2). */
export const WORKING_WINDOW_MS = 60_000;

/** The random bytes of the session token: 128 bits, as 22 base64url characters (AD-11). */
export const SESSION_TOKEN_BYTES = 16;

/** The request header that holds the session token on every local API request (AD-11). */
export const SESSION_TOKEN_HEADER = "X-AskBoard-Session";

/**
 * The longest socket path, in UTF-8 bytes, per platform: `sun_path` holds 104 bytes on macOS and
 * 108 on Linux, each with its terminating NUL (AD-5, AD-11).
 */
export const SOCKET_PATH_MAX_BYTES = { darwin: 103, linux: 107 } as const;

/** Where a notice cuts each piece of agent text: a notification, the toast, a status line. */
export const NOTICE_TEXT_MAX_CHARS = 120;

/**
 * The variable in which Claude Code reads how long an MCP call runs before it moves to the
 * background, and its value when unset; `0` means never (design decision 12).
 */
export const BACKGROUND_THRESHOLD_VARIABLE = "CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS";
export const BACKGROUND_THRESHOLD_DEFAULT_MS = 120_000;

/** The host of every local API URL; the socket path, not the host, says where it goes. */
export const LOCAL_API_HOST = "askboard";

/** The local API's routes (design decision 2). Every request carries the session token header. */
export const LOCAL_API_ROUTES = {
  /** A hook's agent record of an AskBoard call. */
  records: { method: "POST", path: "/v1/records" },
  /** The stop guard's decision on a subagent's stop, taken and acted on in one call. */
  stop: { method: "POST", path: "/v1/stop" },
  /** The effective asking rule and whether a board can be shown. */
  rule: { method: "GET", path: "/v1/rule" },
  /** An ask's title and board link, for the terminal link: `?askId=<id>`. */
  notice: { method: "GET", path: "/v1/notice" },
  /** The mod's version report, once per epoch. */
  modHello: { method: "POST", path: "/v1/mod/hello" },
  /** The mod's report that an agent's turn started or completed. */
  modTurn: { method: "POST", path: "/v1/mod/turn" },
  /** The events above `received` of owned asks, and the pending asks; `?askId=&seq=` continues. */
  poll: { method: "GET", path: "/v1/mod/poll" },
  /** The mod's report of a push that succeeded. */
  delivered: { method: "POST", path: "/v1/mod/delivered" },
} as const;

/** The query parameters of the notice and of a poll's continuation. */
export const LOCAL_API_QUERY = { askId: "askId", seq: "seq" } as const;

/** Where a poll continues: the ask and the `seq` of the first event not returned yet. */
export type PollContinuation = { readonly askId: string; readonly seq: number };

const query = (parameters: readonly (readonly [string, string | number])[]): string =>
  parameters.map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`).join("&");

/** `/v1/notice?askId=<id>`. */
export const noticePath = (askId: string): string =>
  `${LOCAL_API_ROUTES.notice.path}?${query([[LOCAL_API_QUERY.askId, askId]])}`;

/** `/v1/mod/poll`, with the continuation a paged response gave when there is one. */
export const pollPath = (continuation?: PollContinuation): string => {
  const { path } = LOCAL_API_ROUTES.poll;
  if (continuation === undefined) return path;
  const { askId, seq } = continuation;
  return `${path}?${query([
    [LOCAL_API_QUERY.askId, askId],
    [LOCAL_API_QUERY.seq, seq],
  ])}`;
};
