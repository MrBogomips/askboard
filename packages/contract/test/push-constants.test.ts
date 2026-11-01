import { describe, expect, test } from "bun:test";
import {
  BACKGROUND_THRESHOLD_DEFAULT_MS,
  BACKGROUND_THRESHOLD_VARIABLE,
  BOARD_TOKEN_HEADER,
  BOARD_TOKEN_MIN_BITS,
  CLAUDE_CODE_CLIENT_NAME,
  CLAUDE_CODE_MINIMUM,
  HOOK_REQUEST_TIMEOUT_MS,
  LOCAL_API_HOST,
  LOCAL_API_MAX_BYTES,
  LOCAL_API_QUERY,
  LOCAL_API_ROUTES,
  NOTICE_TEXT_MAX_CHARS,
  noticePath,
  POLL_INTERVAL_MS,
  pollPath,
  RECORD_HOLD_MS,
  RECORD_TIMEOUT_MS,
  RECORDS_HELD_MAX,
  SESSION_TOKEN_BYTES,
  SESSION_TOKEN_HEADER,
  SOCKET_PATH_MAX_BYTES,
  sessionFilePath,
  sessionFolder,
  socketPathFor,
  socketPathProblem,
  WORKING_WINDOW_MS,
} from "../src/index.ts";

// Push delivery's shared values (contract spec, Push delivery constants; design decision 1). No
// unit defines its own.
describe("push delivery constants", () => {
  test("the mod polls every second, and a record waits 10 s for its call", () => {
    expect(POLL_INTERVAL_MS).toBe(1_000);
    expect(RECORD_TIMEOUT_MS).toBe(10_000);
  });

  test("an unbound record is held 30 minutes, at most 1,000 of them, past the record timeout", () => {
    expect(RECORD_HOLD_MS).toBe(30 * 60 * 1000);
    expect(RECORD_HOLD_MS).toBeGreaterThan(RECORD_TIMEOUT_MS);
    expect(RECORDS_HELD_MAX).toBe(1_000);
  });

  test("Claude Code 2.1.311 is the minimum", () => {
    expect(CLAUDE_CODE_MINIMUM).toBe("2.1.311");
  });

  test("Claude Code names itself claude-code in its client information", () => {
    expect(CLAUDE_CODE_CLIENT_NAME).toBe("claude-code");
  });

  test("a local API response stays under 1 MiB, and a hook waits 2 s, inside its 5 s", () => {
    expect(LOCAL_API_MAX_BYTES).toBe(1024 * 1024);
    expect(HOOK_REQUEST_TIMEOUT_MS).toBe(2_000);
    expect(HOOK_REQUEST_TIMEOUT_MS).toBeLessThan(5_000);
  });

  test("a board works for 60 s after the last input, and notices cut agent text at 120", () => {
    expect(WORKING_WINDOW_MS).toBe(60_000);
    expect(NOTICE_TEXT_MAX_CHARS).toBe(120);
  });

  test("the session token draws at least 128 bits and travels in its own header", () => {
    expect(SESSION_TOKEN_BYTES * 8).toBeGreaterThanOrEqual(BOARD_TOKEN_MIN_BITS);
    expect(SESSION_TOKEN_HEADER).toBe("X-AskBoard-Session");
    expect(SESSION_TOKEN_HEADER.toLowerCase()).not.toBe(BOARD_TOKEN_HEADER.toLowerCase());
  });

  test("Claude Code backgrounds a call after 120 s unless its variable says otherwise", () => {
    expect(BACKGROUND_THRESHOLD_VARIABLE).toBe("CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS");
    expect(BACKGROUND_THRESHOLD_DEFAULT_MS).toBe(120_000);
  });

  test("a socket path holds at most 103 bytes on macOS and 107 on Linux", () => {
    expect(SOCKET_PATH_MAX_BYTES).toEqual({ darwin: 103, linux: 107 });
  });
});

describe("local API routes (design decision 2)", () => {
  test("are the eight routes under /v1 on the fixed host", () => {
    expect(LOCAL_API_HOST).toBe("askboard");
    expect(LOCAL_API_ROUTES).toEqual({
      records: { method: "POST", path: "/v1/records" },
      stop: { method: "POST", path: "/v1/stop" },
      rule: { method: "GET", path: "/v1/rule" },
      notice: { method: "GET", path: "/v1/notice" },
      modHello: { method: "POST", path: "/v1/mod/hello" },
      modTurn: { method: "POST", path: "/v1/mod/turn" },
      poll: { method: "GET", path: "/v1/mod/poll" },
      delivered: { method: "POST", path: "/v1/mod/delivered" },
    });
  });

  test("the notice names its ask in the query", () => {
    expect(LOCAL_API_QUERY).toEqual({ askId: "askId", seq: "seq" });
    expect(noticePath("order-db-choice-x7k2")).toBe("/v1/notice?askId=order-db-choice-x7k2");
  });

  test("a poll passes the continuation back, or nothing on a first page", () => {
    expect(pollPath()).toBe("/v1/mod/poll");
    expect(pollPath({ askId: "order-db-choice-x7k2", seq: 14 })).toBe(
      "/v1/mod/poll?askId=order-db-choice-x7k2&seq=14",
    );
  });
});

const KEY = 48213;

// Open question 4's default: one folder from one environment, whatever unit computes it.
describe("the session folder and its paths (contract spec, Session folder and paths)", () => {
  test("with XDG_RUNTIME_DIR set, the folder is askboard in it", () => {
    const env = { XDG_RUNTIME_DIR: "/run/user/1000", TMPDIR: "/var/tmp" };
    expect(sessionFolder({ env, uid: 1000 })).toBe("/run/user/1000/askboard");
    expect(sessionFolder({ env: { XDG_RUNTIME_DIR: "/run/user/1000/" }, uid: 1000 })).toBe(
      "/run/user/1000/askboard",
    );
  });

  test.each([
    ["unset", {}],
    ["empty", { XDG_RUNTIME_DIR: "" }],
    ["relative", { XDG_RUNTIME_DIR: "run/user/501" }],
  ])("with XDG_RUNTIME_DIR %s, the folder is askboard-<uid> in TMPDIR", (_case, xdg) => {
    const env = { ...xdg, TMPDIR: "/var/folders/x1/abc/T/" };
    expect(sessionFolder({ env, uid: 501 })).toBe("/var/folders/x1/abc/T/askboard-501");
  });

  test.each([
    ["unset", {}],
    ["empty", { TMPDIR: "" }],
    ["relative", { TMPDIR: "tmp" }],
  ])("with TMPDIR %s as well, the folder is in /tmp", (_case, tmpdir) => {
    expect(sessionFolder({ env: tmpdir, uid: 501 })).toBe("/tmp/askboard-501");
  });

  test("a folder at the root keeps one slash", () => {
    expect(sessionFolder({ env: { XDG_RUNTIME_DIR: "/" }, uid: 0 })).toBe("/askboard");
    expect(sessionFolder({ env: { TMPDIR: "/" }, uid: 0 })).toBe("/askboard-0");
  });

  test("the session file and the socket are named by the key in the folder", () => {
    const folder = sessionFolder({ env: { XDG_RUNTIME_DIR: "/run/user/1000" }, uid: 1000 });
    expect(sessionFilePath(folder, KEY)).toBe("/run/user/1000/askboard/48213.json");
    expect(socketPathFor(folder, KEY)).toBe("/run/user/1000/askboard/48213.sock");
  });

  test("the session process, a hook and the mod compute the same paths from one environment", () => {
    const environment = { XDG_RUNTIME_DIR: undefined, TMPDIR: "/var/folders/x1/abc/T/" };
    const paths = ["session process", "hook", "mod"].map(() => {
      const folder = sessionFolder({ env: { ...environment }, uid: 501 });
      return [folder, sessionFilePath(folder, KEY), socketPathFor(folder, KEY)];
    });
    expect(new Set(paths.map((each) => each.join("\n"))).size).toBe(1);
  });

  test.each([
    ["a negative uid", () => sessionFolder({ env: {}, uid: -1 })],
    ["a fractional uid", () => sessionFolder({ env: {}, uid: 1.5 })],
    ["a key of 0", () => sessionFilePath("/tmp/askboard-501", 0)],
    ["a fractional key", () => socketPathFor("/tmp/askboard-501", 2.5)],
  ])("%s is refused", (_case, compute) => {
    expect(compute).toThrow();
  });
});

// A path of exactly `bytes` UTF-8 bytes: the folder, then a socket name padded with `x`.
const pathOf = (bytes: number, folder = "/tmp/askboard-501/") =>
  `${folder}${"x".repeat(bytes - folder.length - 5)}.sock`;

describe("the socket path's limit (AD-5, AD-11)", () => {
  test.each([
    ["darwin", 103],
    ["linux", 107],
  ])(
    "on %s a path of %i bytes is usable and one byte more is not, naming the limit",
    (platform, limit) => {
      expect(socketPathProblem(pathOf(limit), platform)).toBeUndefined();
      const problem = socketPathProblem(pathOf(limit + 1), platform);
      expect(problem).toContain(`${limit + 1} bytes`);
      expect(problem).toContain(`${limit}`);
    },
  );

  test("counts UTF-8 bytes, not characters", () => {
    const accented = `/tmp/${"é".repeat(50)}`;
    expect(accented.length).toBe(55);
    expect(socketPathProblem(accented, "darwin")).toContain("105 bytes");
    expect(socketPathProblem(accented, "linux")).toBeUndefined();
    expect(socketPathProblem(`/tmp/${"€".repeat(34)}`, "darwin")).toContain("107 bytes");
    expect(socketPathProblem(`/tmp/${"😀".repeat(26)}`, "linux")).toContain("109 bytes");
    // A lone surrogate is written as U+FFFD, three bytes.
    expect(socketPathProblem(`/tmp/${"\uD800".repeat(33)}`, "darwin")).toContain("104 bytes");
  });

  test("a platform outside NFR-7 gets the smaller limit", () => {
    expect(socketPathProblem(pathOf(104), "freebsd")).toContain("103");
    expect(socketPathProblem(pathOf(103), "freebsd")).toBeUndefined();
  });

  test("the paths of macOS's usual TMPDIR fit, with the largest PID", () => {
    const TMPDIR = "/var/folders/7x/k4b2m9qz1h3d8w6f0c5n2j7r0000gn/T/";
    const folder = sessionFolder({ env: { TMPDIR }, uid: 501 });
    expect(socketPathProblem(socketPathFor(folder, 4_194_304), "darwin")).toBeUndefined();
  });
});
