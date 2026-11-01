import { describe, expect, test } from "bun:test";
import {
  BOARD_TOKEN_MAX_CHARS,
  BOARD_TOKEN_PATTERN,
  SESSION_FILE_FORMAT,
  SOCKET_PATH_MAX_BYTES,
} from "../src/index.ts";
import sessionFileSchema from "../src/push/session-file/session-file.json";
import { type Checked, validateSessionFile } from "../src/validate.ts";

// The session file (owner board-host, AD-5; design decision 3): how the hooks and the mod find the
// session process. A file that fails is no session: the client treats it as unreachable.
const file = {
  format: SESSION_FILE_FORMAT,
  key: 48213,
  pid: 48250,
  epoch: "k3x9",
  apiAddress: "/run/user/1000/askboard/48213.sock",
  sessionToken: "Hc4nQ8vLw2Zr7TxB5mKp9A",
  projectDir: "/Users/paola/src/order-service",
  startedAt: "2026-10-29T09:40:02.117Z",
};
const FIELDS = [
  "format",
  "key",
  "pid",
  "epoch",
  "apiAddress",
  "sessionToken",
  "projectDir",
  "startedAt",
];

// projectDir is the session project root, which a session without CLAUDE_PROJECT_DIR does not have.
const REQUIRED = FIELDS.filter((field) => field !== "projectDir");

const problemPaths = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);
const without = (field: string) =>
  Object.fromEntries(Object.entries(file).filter(([key]) => key !== field));

describe("the session file (contract spec, Session file schema)", () => {
  test("holds exactly AD-5's fields, each required but projectDir, at format 1.0", () => {
    expect(SESSION_FILE_FORMAT).toBe("1.0");
    expect(Object.keys(sessionFileSchema.properties)).toEqual(FIELDS);
    expect(sessionFileSchema.required).toEqual(REQUIRED);
    expect(sessionFileSchema.$id).toBe("urn:askboard:session-file:session-file");
    expect(validateSessionFile(file)).toEqual({ ok: true, value: file });
  });

  test("with an extra field fails, naming it", () => {
    expect(validateSessionFile({ ...file, port: 47213 })).toEqual({
      ok: false,
      reason: "schema",
      problems: [{ path: "/port", message: 'unknown field "port"' }],
    });
  });

  test("without projectDir, as in a session with no project root (AD-12), validates", () => {
    const { projectDir: _none, ...rootless } = file;
    expect(validateSessionFile(rootless)).toEqual({ ok: true, value: rootless });
  });

  test.each(REQUIRED.filter((field) => field !== "format"))(
    "without %s fails, naming it",
    (field) => {
      expect(validateSessionFile(without(field))).toEqual({
        ok: false,
        reason: "schema",
        problems: [{ path: `/${field}`, message: `missing field "${field}"` }],
      });
    },
  );

  test("of another format major, or naming none, is refused before its schema, naming 1", () => {
    const later = validateSessionFile({ ...file, format: "2.0", port: 47213 });
    expect(later).toMatchObject({ ok: false, reason: "version" });
    expect(problemPaths(later)).toEqual(["/format"]);
    if (!later.ok) expect(later.problems[0]?.message).toContain("supports version 1");
    expect(validateSessionFile(without("format"))).toMatchObject({ ok: false, reason: "version" });
    expect(validateSessionFile(null)).toMatchObject({ ok: false, reason: "version" });
    expect(validateSessionFile({ ...file, format: "1.3" }).ok).toBe(true);
  });

  test.each([
    ["a key of 0", { key: 0 }, "/key"],
    ["a fractional pid", { pid: 1.5 }, "/pid"],
    ["a malformed epoch", { epoch: "K3X9" }, "/epoch"],
    ["a relative socket path", { apiAddress: "askboard/48213.sock" }, "/apiAddress"],
    ["a socket path over Linux's limit", { apiAddress: `/${"x".repeat(107)}` }, "/apiAddress"],
    ["a short token", { sessionToken: "Hc4nQ8vLw2" }, "/sessionToken"],
    ["a relative project", { projectDir: "order-service" }, "/projectDir"],
    ["a local start time", { startedAt: "2026-10-29T11:40:02+02:00" }, "/startedAt"],
  ])("with %s fails", (_case, change, path) => {
    expect(problemPaths(validateSessionFile({ ...file, ...change }))).toEqual([path]);
  });

  test("its token is written as a board token is, and its socket path within the larger limit", () => {
    const { apiAddress, sessionToken } = sessionFileSchema.properties;
    expect(sessionToken.pattern).toBe(BOARD_TOKEN_PATTERN);
    expect(sessionToken.maxLength).toBe(BOARD_TOKEN_MAX_CHARS);
    expect(apiAddress.maxLength).toBe(SOCKET_PATH_MAX_BYTES.linux);
  });
});
