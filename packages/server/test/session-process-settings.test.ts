import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOARD_PROTOCOL_VERSION, LOCAL_API_ROUTES, type SessionFile } from "@askboard/contract";
import { validateSessionFile } from "@askboard/contract/validate";
import { openSocket, plainChoiceAsk } from "./board-host/helpers.ts";
import { localRequest } from "./board-host/local-api/helpers.ts";
import { CLAUDE_CODE, composedSessions, waitForFile } from "./composed-session.ts";

// The configuration wired into the session process (settings-languages, task 4.6; design decisions
// 3 and 12): ask-core reads the user file under the session's home and the project file, the local
// API starts once that read settles and answers the rule in effect from its first `/v1/rule`, and
// the first accepted ask creates `.askboard/` in the project.

const { start, project, remove, unwatched } = composedSessions();
const homes = mkdtempSync(join(tmpdir(), "askboard-settings-homes-"));
const projectFile = join(project, ".askboard", "config.json");
let count = 0;

afterEach(() => rmSync(join(project, ".askboard"), { recursive: true, force: true }));
afterAll(() => {
  remove();
  rmSync(homes, { recursive: true, force: true });
});

type Run = Awaited<ReturnType<typeof start>>;

/** A home of its own, holding the user file when given. */
const homeWith = (user?: unknown): string => {
  count += 1;
  const home = join(homes, `home-${count}`);
  mkdirSync(join(home, ".config", "askboard"), { recursive: true });
  if (user !== undefined) {
    writeFileSync(join(home, ".config", "askboard", "config.json"), JSON.stringify(user));
  }
  return home;
};

const writeProject = (value: unknown): void => {
  mkdirSync(join(project, ".askboard"), { recursive: true });
  writeFileSync(projectFile, JSON.stringify(value));
};

const sessionOf = async (run: Run): Promise<SessionFile> => {
  for (let tries = 0; tries < 300 && !existsSync(run.sessionFile); tries += 1) await Bun.sleep(10);
  const checked = validateSessionFile(JSON.parse(readFileSync(run.sessionFile, "utf8")));
  if (!checked.ok) throw new Error(JSON.stringify(checked.problems));
  return checked.value;
};

/** The rule the session's first `/v1/rule` answers, its local API started by the first request. */
const firstRule = async (run: Run): Promise<unknown> => {
  await run.client.listTools();
  const session = await sessionOf(run);
  const answer = await localRequest(session.apiAddress, LOCAL_API_ROUTES.rule.path, {
    method: "GET",
    token: session.sessionToken,
  });
  expect(answer.status).toBe(200);
  return (answer.json() as { rule: unknown }).rule;
};

const ended = async (run: Run) => {
  run.emit("SIGTERM");
  await run.session.ended;
};

const AUTO = { ...CLAUDE_CODE, negotiation: "auto" } as const;

describe("the configuration wired into the session process", () => {
  test("the project's rule wins over the user's from the first /v1/rule", async () => {
    writeProject({ version: "1.0", askingRule: "always" });
    const home = homeWith({ version: "1.0", askingRule: "with-references" });
    const run = await start({ HOME: home }, undefined, AUTO);
    expect(await firstRule(run)).toBe("always");
    expect(run.stderr).toEqual([]);
    await ended(run);
  });

  test("the user's rule, without a project file", async () => {
    const run = await start(
      { HOME: homeWith({ version: "1.0", askingRule: "always" }) },
      undefined,
      AUTO,
    );
    expect(await firstRule(run)).toBe("always");
    await ended(run);
  });

  test("a project file that fails its check gives none, and stderr names the file and pointer", async () => {
    writeProject({ version: "1.0", askingRule: "always", theme: "sepia" });
    const run = await start({ HOME: homeWith() }, undefined, AUTO);
    expect(await firstRule(run)).toBe("none");
    const said = run.stderr.join("");
    expect(said).toContain(".askboard/config.json is not applied");
    expect(said).toContain("/theme");
    await ended(run);
  });

  test("an unreadable project file still lets the local API start", async () => {
    mkdirSync(projectFile, { recursive: true });
    const run = await start(
      { HOME: homeWith({ version: "1.0", askingRule: "always" }) },
      undefined,
      AUTO,
    );
    expect(await firstRule(run)).toBe("always");
    expect(run.stderr.join("")).toContain(".askboard/config.json is not applied");
    await ended(run);
  });

  test("the user file's theme reaches a board, and the first ask creates .askboard/", async () => {
    const run = await start({ HOME: homeWith({ version: "1.0", theme: "dark" }) });
    expect(existsSync(join(project, ".askboard"))).toBe(false);
    const asked = await run.call("ask", plainChoiceAsk("settings-wired"));
    // Started without BROWSER, the session shows its board through the helper's recorder, never
    // through the machine's opener, which would start a real browser (#160).
    expect(await waitForFile(unwatched.record)).toBe(`${asked.board}\n`);
    const link = new URL(asked.board);
    const board = await openSocket(Number(link.port), "settings-wired");
    board.send({
      version: BOARD_PROTOCOL_VERSION,
      type: "connect",
      token: link.searchParams.get("t"),
    });
    expect(await board.nextSettings()).toMatchObject({
      keys: { theme: { value: "dark", from: "user" } },
    });
    board.socket.terminate();
    for (
      let tries = 0;
      tries < 100 && !existsSync(join(project, ".askboard", ".gitignore"));
      tries += 1
    ) {
      await Bun.sleep(10);
    }
    expect(readFileSync(join(project, ".askboard", ".gitignore"), "utf8")).toBe(
      "snapshots/\nmedia/\npatches/\nbench/\n",
    );
    await ended(run);
  });
});
