import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import {
  BOARD_CLOSE_CODES,
  BOARD_PORT_RANGE,
  BOARD_PROTOCOL_VERSION,
  BOARD_RESPONSES,
  GRACE_PERIOD_MS,
  SNAPSHOT_DATA_ELEMENT,
} from "@askboard/contract";
import { ONE_PIXEL_PNG, plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { validateSnapshotData } from "@askboard/contract/validate";
import { sessionProjectRoot } from "../src/push-composition.ts";
import {
  manualClock,
  openSocket,
  plainChoiceAsk,
  request,
  writeView,
} from "./board-host/helpers.ts";
import { CLAUDE_CODE, composedSessions, waitForFile } from "./composed-session.ts";

// The session process as the entry point composes it (design decisions 3 and 9, task 7.2): ask-core
// with board-host's address, the notifier's showing and the system identity, served by mcp-tools.
// Driven in process over an in-memory transport, with a recorder script as BROWSER.

const version = BOARD_PROTOCOL_VERSION;
const [question] = plainChoiceBoardDocument.items;
const { project, recorder, start, remove } = composedSessions();
afterAll(remove);

describe("the composed session process", () => {
  test("serves an ask from the tool call to the board and back, then ends cleanly", async () => {
    const { script, record } = recorder("browser");
    const run = await start({ BROWSER: script });
    const { tools } = await run.client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "ask",
      "update",
      "collect",
      "fetch",
      "snapshot",
    ]);

    const asked = await run.call("ask", plainChoiceAsk());
    const link = new URL(asked.board);
    const token = link.searchParams.get("t") ?? "";
    const port = Number(link.port);
    expect(link.hostname).toBe("127.0.0.1");
    expect(port).toBeGreaterThanOrEqual(BOARD_PORT_RANGE.first);
    expect(port).toBeLessThanOrEqual(BOARD_PORT_RANGE.last);
    expect(await waitForFile(record)).toBe(`${asked.board}\n`);

    const page = await request(port, `${link.pathname}${link.search}`);
    expect(page.status).toBe(BOARD_RESPONSES.boardPage.status);

    const board = await openSocket(port, asked.askId);
    board.send({ version, type: "connect", token });
    expect(await board.next()).toMatchObject({ type: "board" });
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "waiting" } });
    board.send({
      version,
      type: "answer",
      itemId: question.id,
      rev: 1,
      choice: ["PostgreSQL"],
      when: "2026-10-30T09:41:27Z",
    });
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "answered" } });

    const collected = await run.call("collect", {
      asks: [{ askId: asked.askId, after: asked.cursor }],
    });
    expect(collected.asks[0].events[0]).toMatchObject({
      type: "answer",
      choice: ["PostgreSQL"],
      who: "Paola Greco",
      when: "2026-10-30T09:41:27Z",
    });
    expect(await board.next()).toEqual({
      version,
      type: "receipt",
      itemId: question.id,
      receipt: "delivered",
    });

    // stdin's end: the board hears the discard, the listener closes, the process exits 0.
    await run.client.close();
    expect(await run.session.ended).toBe(0);
    expect(await board.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
    expect(await board.closed()).toBe(BOARD_CLOSE_CODES.discarded);
    expect(run.exits).toEqual([0]);
    await expect(request(port, "/m")).rejects.toThrow();
    const stderr = run.stderr.join("\n");
    expect(stderr).not.toContain(token);
    expect(stderr).not.toContain(question.props.text);
  });

  test("SIGINT with a board connected tells the board, closes the listener and exits 0", async () => {
    const { script } = recorder("sigint");
    const run = await start({ BROWSER: script });
    const asked = await run.call("ask", plainChoiceAsk("sigint-board"));
    const link = new URL(asked.board);
    const port = Number(link.port);
    const board = await openSocket(port, asked.askId);
    board.send({ version, type: "connect", token: link.searchParams.get("t") });
    await board.next();
    await board.next();
    run.emit("SIGINT");
    expect(await run.session.ended).toBe(0);
    expect(await board.next()).toEqual({ version, type: "discarded", reason: "session-exit" });
    expect(await board.closed()).toBe(BOARD_CLOSE_CODES.discarded);
    expect(run.exits).toEqual([0]);
    await expect(request(port, "/m")).rejects.toThrow();
    expect(run.stderr).toEqual(["askboard: session ending (SIGINT): 1 open ask discarded"]);
  });

  test("reports a browser that cannot start on stderr, with neither the link nor its token", async () => {
    const run = await start({ BROWSER: join(project, "no-such-browser") });
    const asked = await run.call("ask", plainChoiceAsk("browser-missing"));
    const token = new URL(asked.board).searchParams.get("t") ?? "";
    for (let tries = 0; tries < 200 && run.stderr.length === 0; tries += 1) await Bun.sleep(10);
    expect(run.stderr).toEqual(["askboard: opening the board failed: Error (ENOENT)"]);
    expect(run.stderr.join("\n")).not.toContain(token);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });

  test("a missing view build fails the ask with its own error, at the ask and not at start", async () => {
    const { script, record } = recorder("no-view");
    const run = await start({ BROWSER: script }, writeView({}));
    const result = await run.client.callTool({ name: "ask", arguments: plainChoiceAsk("no-view") });
    expect(result.isError).toBe(true);
    const [content] = result.content as { text: string }[];
    expect(content?.text).toContain("view build is missing or damaged");
    expect(existsSync(record)).toBe(false);
    expect(run.stderr).toEqual(["askboard: ask failed: ViewBuildError (VIEW_MANIFEST_UNREADABLE)"]);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });

  test("answers unavailable inside a container, opening no port", async () => {
    const run = await start({ DEVCONTAINER: "true" });
    const asked = await run.call("ask", plainChoiceAsk("in-a-container"));
    expect(asked).toMatchObject({ outcome: "unavailable", reason: "container" });
    expect(asked.message).toContain("DEVCONTAINER");
    run.emit("SIGINT");
    expect(await run.session.ended).toBe(0);
    expect(run.stderr.filter((line) => !line.startsWith("askboard: session ending"))).toEqual([]);
  });
});

// ask-lifecycle, task 5.3: the entry point's wiring of the Clock and the new subscriptions, with
// the real units and a clock the test moves, so the grace period passes without a real wait.

const threeQuestions = (askId: string) => ({
  askId,
  items: [
    { type: "question", id: "database", props: question.props },
    {
      type: "question",
      id: "cache",
      props: { text: "Which cache?", options: [{ label: "Redis" }, { label: "None" }] },
    },
    {
      type: "question",
      id: "queue",
      props: { text: "Which queue?", options: [{ label: "SQS" }, { label: "None" }] },
    },
  ],
});

const answerAct = (actionId: string, itemId: string, choice: string) => ({
  version,
  type: "act",
  actionId,
  acts: [{ type: "answer", itemId, rev: 1, choice: [choice], when: "2026-10-31T09:41:27Z" }],
});

const until = async (done: () => boolean) => {
  for (let tries = 0; tries < 200 && !done(); tries += 1) await Bun.sleep(10);
  expect(done()).toBe(true);
};

describe("the ask lifecycle in the composed session process", () => {
  test("a board closed past the grace period ends a waiting collect with the answer, then the discard", async () => {
    const { script } = recorder("grace");
    const time = manualClock();
    const run = await start({ BROWSER: script }, writeView(), CLAUDE_CODE, time.clock);
    const asked = await run.call("ask", threeQuestions("grace-board-k4p2"));
    const link = new URL(asked.board);
    const board = await openSocket(Number(link.port), asked.askId);
    board.send({ version, type: "connect", token: link.searchParams.get("t") });
    expect(await board.next()).toMatchObject({ type: "board" });
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "waiting" } });

    // A first answer makes the ask partly answered, and the agent collects it.
    const first = "gR4c3PeriodAct10nId001";
    board.send(answerAct(first, "database", "PostgreSQL"));
    expect(await board.next()).toEqual({ version, type: "done", actionId: first });
    expect(await board.next()).toMatchObject({ state: { ask: "partly-answered" } });
    const before = await run.call("collect", {
      asks: [{ askId: asked.askId, after: asked.cursor }],
    });
    const cursor = before.asks[0].cursor;
    expect(cursor).toBe(`${asked.epoch}.1`);
    expect(await board.next()).toMatchObject({ type: "receipt", itemId: "database" });

    // The agent waits on queue; an answer to cache leaves the ask partly answered, so the wait goes
    // on (AD-4).
    let returned = false;
    const waiting = run
      .call("collect", {
        asks: [{ askId: asked.askId, after: cursor }],
        wait: { askId: asked.askId, itemId: "queue" },
      })
      .finally(() => {
        returned = true;
      });
    const second = "gR4c3PeriodAct10nId002";
    board.send(answerAct(second, "cache", "Redis"));
    expect(await board.next()).toEqual({ version, type: "done", actionId: second });
    expect(await board.next()).toMatchObject({ state: { ask: "partly-answered" } });
    await Bun.sleep(30);
    expect(returned).toBe(false);

    board.socket.close();
    await board.closed();
    await until(() => time.delays.includes(GRACE_PERIOD_MS));
    time.advance(GRACE_PERIOD_MS - 1);
    await Bun.sleep(30);
    expect(returned).toBe(false);
    time.advance(1);
    const collected = await waiting;
    expect(collected.asks).toEqual([
      {
        askId: asked.askId,
        state: "discarded",
        cursor: `${asked.epoch}.3`,
        events: [
          expect.objectContaining({ type: "answer", itemId: "cache", choice: ["Redis"] }),
          { cursor: `${asked.epoch}.3`, type: "discarded", reason: "board-closed" },
        ],
        unchecked: true,
      },
    ]);
    expect(collected.outcome).toBeUndefined();
    const page = await request(Number(link.port), `${link.pathname}${link.search}`);
    expect(page.status).toBe(BOARD_RESPONSES.discardedLink.status);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });

  test("no environment variable changes the grace period, and the entry point gives no clock", async () => {
    const { script } = recorder("no-override");
    const time = manualClock();
    const overrides = {
      ASKBOARD_GRACE_PERIOD_MS: "1",
      ASKBOARD_GRACE_MS: "1",
      ASKBOARD_GRACE: "1",
      GRACE_PERIOD_MS: "1",
    };
    const run = await start(
      { BROWSER: script, ...overrides },
      writeView(),
      CLAUDE_CODE,
      time.clock,
    );
    const asked = await run.call("ask", plainChoiceAsk("no-override-board"));
    const link = new URL(asked.board);
    const board = await openSocket(Number(link.port), asked.askId);
    board.send({ version, type: "connect", token: link.searchParams.get("t") });
    await board.next();
    await board.next();
    board.socket.close();
    await board.closed();
    await until(() => time.delays.length > 0);
    expect(time.delays).toEqual([GRACE_PERIOD_MS]);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
    // The shipped bundle's entry point passes no clock: the system clock and the contract's grace
    // period run, and nothing it reads names a grace period.
    const entry = readFileSync(join(import.meta.dir, "..", "src", "main.ts"), "utf8");
    expect(entry).not.toMatch(/clock|grace/i);
    const composition = readFileSync(
      join(import.meta.dir, "..", "src", "session-process.ts"),
      "utf8",
    );
    expect(composition).not.toMatch(/GRACE|env\.[A-Z_]*GRACE/);
  });
});

describe("the session project root (AD-12)", () => {
  test("is the real path of CLAUDE_PROJECT_DIR", () => {
    const linked = join(dirname(project), "linked-project");
    symlinkSync(project, linked);
    expect(sessionProjectRoot({ CLAUDE_PROJECT_DIR: linked })).toBe(realpathSync(project));
    expect(sessionProjectRoot({ CLAUDE_PROJECT_DIR: project })).toBe(realpathSync(project));
  });

  test("is absent when the variable is not set, is empty or names no folder", () => {
    expect(sessionProjectRoot({})).toBeUndefined();
    expect(sessionProjectRoot({ CLAUDE_PROJECT_DIR: "" })).toBeUndefined();
    const gone = join(dirname(project), "removed-project");
    mkdirSync(gone);
    expect(sessionProjectRoot({ CLAUDE_PROJECT_DIR: join(gone, "not-there") })).toBeUndefined();
  });

  // Review fix L2: a relative path would resolve against the working folder, which never stands in.
  test("is absent for a relative path, even one naming the project from the working folder", () => {
    const named = relative(process.cwd(), project);
    expect(realpathSync(named)).toBe(realpathSync(project));
    expect(sessionProjectRoot({ CLAUDE_PROJECT_DIR: named })).toBeUndefined();
    expect(sessionProjectRoot({ CLAUDE_PROJECT_DIR: "." })).toBeUndefined();
  });

  test("is absent when the path, or the one its link points to, names a file", () => {
    const file = join(dirname(project), "project-file.txt");
    writeFileSync(file, "not a folder");
    const linked = join(dirname(project), "linked-file");
    symlinkSync(file, linked);
    expect(sessionProjectRoot({ CLAUDE_PROJECT_DIR: file })).toBeUndefined();
    expect(sessionProjectRoot({ CLAUDE_PROJECT_DIR: linked })).toBeUndefined();
  });
});

// Excerpts (E5, task 5.5): the session process reads pointers in the session project root alone,
// through the excerpts unit, and board-host starts the editor command given to it.
const ADR = [
  "# ADR 12: Payment retries",
  "",
  "## Decision",
  "",
  "We retry a failed payment three times.",
  "",
  "## Consequences",
  "",
].join("\n");
const RETRY = [
  "export const retries = 3;",
  "",
  "export const backoff = (n: number) =>",
  "  2 ** n;",
  "",
];

/** Writes the files the context ask points at under `root`. */
const writeContextFiles = (root: string) => {
  mkdirSync(join(root, "docs", "adr"), { recursive: true });
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, ".askboard", "media"), { recursive: true });
  writeFileSync(join(root, "docs", "adr", "0012-payment-retries.md"), ADR);
  writeFileSync(join(root, "src", "retry.ts"), RETRY.join("\n"));
  writeFileSync(join(root, ".askboard", "media", "shot.png"), Buffer.from(ONE_PIXEL_PNG, "base64"));
};

const POINTERS = {
  "retry-adr": "docs/adr/0012-payment-retries.md#Decision",
  "retry-src": "src/retry.ts#L3-L4",
  shot: ".askboard/media/shot.png",
} as const;

/** One question holding every context item: a pointer and a written excerpt, two references, an image. */
const contextAsk = (askId: string) => ({
  askId,
  items: [
    {
      type: "question",
      id: "fix",
      props: {
        text: "Which fix should I keep for the failing payment retry?",
        options: [{ label: "Fix A" }, { label: "Fix B" }],
        items: [
          { type: "excerpt", id: "retry-adr", props: { pointer: POINTERS["retry-adr"] } },
          { type: "excerpt", id: "note", props: { text: "Seen on 2 November.", title: "Note" } },
          { type: "reference", id: "retry-src", props: { pointer: POINTERS["retry-src"] } },
          { type: "reference", id: "pr", props: { url: "https://github.com/acme/pay/pull/12" } },
          { type: "image", id: "shot", props: { pointer: POINTERS.shot, alt: "The retry log" } },
        ],
      },
    },
  ],
});

type Warning = { code: string; itemId?: string; reason?: string };

/** The ask result's `unresolved-pointer` warnings; the session has no hooks, so `no-hooks` joins. */
const unresolved = (warnings: readonly Warning[]) =>
  warnings
    .filter(({ code }) => code === "unresolved-pointer")
    .map(({ code, itemId, reason }) => ({ code, itemId, reason }));

type ContextBoard = { items: { props: { items: { id: string; props: object }[] } }[] };

/** Whether a process whose command line holds `text` is still running. */
const running = (text: string) => Bun.spawnSync(["pgrep", "-f", text]).exitCode === 0;

describe("context in the composed session process (excerpts)", () => {
  test("an ask with every context item resolves, and open-editor starts the command on the real path", async () => {
    writeContextFiles(project);
    const browser = recorder("context-browser");
    const editor = recorder("context-editor");
    const run = await start(
      { BROWSER: browser.script },
      writeView(),
      CLAUDE_CODE,
      undefined,
      undefined,
      () => [editor.script, "{file}", "{line}"],
    );
    const asked = await run.call("ask", contextAsk("context-every-item"));
    expect(unresolved(asked.warnings)).toEqual([]);
    const link = new URL(asked.board);
    const board = await openSocket(Number(link.port), asked.askId);
    board.send({ version, type: "connect", token: link.searchParams.get("t") });
    const sent = (await board.next()) as { type: string; document: ContextBoard };
    expect(sent.type).toBe("board");
    const items = sent.document.items[0]?.props.items ?? [];
    expect(Object.fromEntries(items.map((item) => [item.id, item.props]))).toEqual({
      "retry-adr": {
        pointer: POINTERS["retry-adr"],
        status: "resolved",
        text: "## Decision\n\nWe retry a failed payment three times.",
        mediaType: "text/markdown",
        lines: { start: 3, end: 5 },
      },
      note: { text: "Seen on 2 November.", title: "Note" },
      "retry-src": {
        pointer: POINTERS["retry-src"],
        kind: "file",
        status: "resolved",
        lines: { start: 3, end: 4 },
      },
      pr: { url: "https://github.com/acme/pay/pull/12", kind: "github" },
      shot: {
        pointer: POINTERS.shot,
        alt: "The retry log",
        status: "resolved",
        mediaType: "image/png",
        bytes: ONE_PIXEL_PNG,
      },
    });
    await board.next();

    board.send({ version, type: "open-editor", itemId: "retry-src" });
    expect(await board.next()).toEqual({
      version,
      type: "editor-outcome",
      itemId: "retry-src",
      outcome: "opened",
    });
    const real = realpathSync(join(project, "src", "retry.ts"));
    expect((await waitForFile(editor.record)).split("\n")).toEqual([real, "3", ""]);
    for (let tries = 0; tries < 200 && running(editor.script); tries += 1) await Bun.sleep(10);
    expect(running(editor.script)).toBe(false);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });

  test("without CLAUDE_PROJECT_DIR every pointer is no-root, even with the working folder holding the file", async () => {
    // The working folder of `start` is the project's parent.
    writeContextFiles(dirname(project));
    const { script } = recorder("context-no-root");
    const run = await start({ BROWSER: script, CLAUDE_PROJECT_DIR: "" });
    const asked = await run.call("ask", contextAsk("context-no-root"));
    expect(unresolved(asked.warnings)).toEqual(
      ["retry-adr", "retry-src", "shot"].map((itemId) => ({
        code: "unresolved-pointer",
        itemId,
        reason: "no-root",
      })),
    );
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });

  test("the shipped bundle's composition gives board-host the user file's editor command (settings-languages, design decision 5)", () => {
    const entry = readFileSync(join(import.meta.dir, "..", "src", "session-entry.ts"), "utf8");
    expect(entry).not.toMatch(/editor|sources/i);
    const composition = readFileSync(
      join(import.meta.dir, "..", "src", "session-process.ts"),
      "utf8",
    );
    expect(composition).toContain(
      "editorCommand: options.editorCommand ?? (() => userEditor(coreOf()))",
    );
  });
});

// E7, task 4.4: the Snapshot writer the entry point composes beside push delivery's ports, with the
// session project root as its root and the view build board-host serves, reached through the
// snapshot tool (task 5.2) and the board's `snapshot` command (task 6.1).

const snapshotsOf = (folder: string): string[] => {
  const snapshots = join(folder, ".askboard", "snapshots");
  return existsSync(snapshots) ? readdirSync(snapshots).sort() : [];
};

/** The `askboard-data` block, cut out by the text rule. */
const dataBlockOf = (page: string): unknown => {
  const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start)));
};

describe("Snapshots in the composed session process (E7)", () => {
  test("an ask answered on the board and the snapshot tool's Snapshot leave one file, which outlives the session", async () => {
    const { script } = recorder("snapshot");
    const run = await start({ BROWSER: script });
    const asked = await run.call("ask", plainChoiceAsk("snapshot-board-r7t2"));
    const link = new URL(asked.board);
    const token = link.searchParams.get("t") ?? "";
    const board = await openSocket(Number(link.port), asked.askId);
    board.send({ version, type: "connect", token });
    expect(await board.next()).toMatchObject({ type: "board" });
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "waiting" } });
    board.send({
      version,
      type: "answer",
      itemId: question.id,
      rev: 1,
      choice: ["PostgreSQL"],
      when: "2026-11-03T09:41:27Z",
    });
    expect(await board.next()).toMatchObject({ type: "state", state: { ask: "answered" } });

    const before = snapshotsOf(project);
    const taken = await run.call("snapshot", { askId: asked.askId });
    expect(taken).toMatchObject({ askId: asked.askId, state: "answered", unchecked: true });
    expect(dirname(taken.path)).toBe(join(realpathSync(project), ".askboard", "snapshots"));
    expect(snapshotsOf(project)).toEqual([...before, basename(taken.path)].sort());

    const page = readFileSync(taken.path, "utf8");
    const checked = validateSnapshotData(dataBlockOf(page));
    if (!checked.ok) throw new Error(JSON.stringify(checked.problems));
    expect(checked.value).toMatchObject({
      askId: asked.askId,
      snapshot: { takenBy: "agent" },
      state: { ask: "answered" },
    });
    expect(checked.value.events.map(({ event }) => event)).toEqual([
      expect.objectContaining({ type: "answer", choice: ["PostgreSQL"], who: "Paola Greco" }),
    ]);
    const session = JSON.parse(await waitForFile(run.sessionFile)) as { sessionToken: string };
    expect(page).not.toContain(token);
    expect(page).not.toContain(session.sessionToken);

    // The board's Snapshot is the user's, with its unsent-work flag, in the same folder.
    const requestId = "mZ4aD8wEg2UyB6fTj9oHqL";
    board.send({ version, type: "snapshot", requestId, unsentWork: true });
    const reply = (await board.next()) as { type: string; requestId: string; path: string };
    expect(reply).toMatchObject({ type: "snapshot-saved", requestId });
    expect(dirname(reply.path)).toBe(dirname(taken.path));
    const users = validateSnapshotData(dataBlockOf(readFileSync(reply.path, "utf8")));
    if (!users.ok) throw new Error(JSON.stringify(users.problems));
    expect(users.value.snapshot).toMatchObject({
      takenBy: "user",
      who: "Paola Greco",
      unsentWork: true,
    });
    expect(snapshotsOf(project)).toEqual(
      [...before, basename(taken.path), basename(reply.path)].sort(),
    );

    // stdin's end discards the ask; the Snapshot stays as it was (Snapshots outlive their ask).
    await run.client.close();
    expect(await run.session.ended).toBe(0);
    expect(readFileSync(taken.path, "utf8")).toBe(page);
    expect(snapshotsOf(project)).toContain(basename(taken.path));
    expect(snapshotsOf(project)).toContain(basename(reply.path));
  });

  test("without CLAUDE_PROJECT_DIR, a Snapshot is refused naming the variable, creating nothing", async () => {
    const { script, record } = recorder("snapshot-no-root");
    const run = await start({ BROWSER: script, CLAUDE_PROJECT_DIR: undefined });
    const asked = await run.call("ask", plainChoiceAsk("snapshot-no-root-b4n8"));
    expect(await waitForFile(record)).toBe(`${asked.board}\n`);
    // The session's working folder, which stands in for the project in its display only.
    const working = dirname(project);
    const before = readdirSync(working).sort();
    const refused = await run.callRaw("snapshot", { askId: asked.askId });
    expect(refused.isError).toBe(true);
    const [content] = refused.content as { text: string }[];
    expect(content?.text).toStartWith(
      `No Snapshot was taken of the ask "${asked.askId}": CLAUDE_PROJECT_DIR is not set`,
    );
    expect(existsSync(join(working, ".askboard", "snapshots"))).toBe(false);
    expect(readdirSync(working).sort()).toEqual(before);
    expect(run.stderr).toContain(
      "askboard: no Snapshot without a session project root: CLAUDE_PROJECT_DIR is not set",
    );
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });
});
