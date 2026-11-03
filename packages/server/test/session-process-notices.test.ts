import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BOARD_PROTOCOL_VERSION } from "@askboard/contract";
import { workingPresence } from "@askboard/contract/fixtures";
import { openSocket, plainChoiceAsk } from "./board-host/helpers.ts";
import { composedSessions, waitForFile } from "./composed-session.ts";

// The notifier's notices and the boards' working flags in the composed session process (task 5.4;
// board-host spec, System notification, Working boards and the modified "Opening a board in the
// browser"): a new ask opens its board through BROWSER and shows one notification, through the
// recorders on PATH; while a board of the session works, a new ask notifies and opens nothing; and
// a notifier still running is killed at exit.

const { recorder, start, remove } = composedSessions();
const folder = mkdtempSync(join(tmpdir(), "askboard-notices-"));
afterAll(() => {
  remove();
  rmSync(folder, { recursive: true, force: true });
});

const version = BOARD_PROTOCOL_VERSION;
const NOTIFIER = process.platform === "darwin" ? "osascript" : "notify-send";
const TITLE = "Which database should the order service use?";

const waitFor = async (check: () => boolean, what: string) => {
  for (let tries = 0; tries < 300 && !check(); tries += 1) await Bun.sleep(10);
  if (!check()) throw new Error(`timed out waiting for ${what}`);
};

const lines = (path: string) =>
  existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean) : [];

describe("a new ask", () => {
  test("opens its board through BROWSER and shows one notification", async () => {
    const { script, record } = recorder("notice-browser");
    const run = await start({ BROWSER: script });
    const asked = await run.call("ask", plainChoiceAsk("notice-one"));
    expect(await waitForFile(record)).toBe(`${asked.board}\n`);
    await waitFor(() => run.notified().length === 1, "the notification");
    const [notified] = run.notified();
    expect(notified?.[0]).toBe(NOTIFIER);
    expect(notified).toContain(TITLE);
    // An ask with no agent record: the project and the question count.
    expect(notified?.at(-1)).toBe("project · 1 question");
    // An identical resend opens nothing and notifies nothing.
    await run.call("ask", plainChoiceAsk("notice-one"));
    await Bun.sleep(100);
    expect(run.notified()).toHaveLength(1);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
    expect(run.stderr.filter((line) => !line.startsWith("askboard: session ending"))).toEqual([]);
  });

  test("while a board of the session works, it notifies and opens nothing", async () => {
    const { script, record } = recorder("notice-working");
    const run = await start({ BROWSER: script });
    const first = await run.call("ask", plainChoiceAsk("notice-first"));
    expect(await waitForFile(record)).toBe(`${first.board}\n`);
    const link = new URL(first.board);
    const board = await openSocket(Number(link.port), first.askId);
    board.send({ version, type: "connect", token: link.searchParams.get("t") });
    await board.next();
    await board.next();
    board.send(workingPresence);
    await Bun.sleep(50);
    rmSync(record);
    await run.call("ask", plainChoiceAsk("notice-second"));
    await waitFor(() => run.notified().length === 2, "the second notification");
    await Bun.sleep(100);
    expect(existsSync(record)).toBe(false);
    // The board stops working: the next ask opens again.
    board.send({ ...workingPresence, working: false });
    await Bun.sleep(50);
    const third = await run.call("ask", plainChoiceAsk("notice-third"));
    expect(await waitForFile(record)).toBe(`${third.board}\n`);
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
  });
});

describe("at exit", () => {
  test("a notifier still running is killed", async () => {
    // Notifiers that keep running, as notify-send does while it waits for the user.
    const bin = mkdtempSync(join(folder, "bin-"));
    const pids = join(bin, "pids");
    for (const command of ["osascript", "notify-send"]) {
      writeFileSync(
        join(bin, command),
        [
          "#!/bin/sh",
          `if [ "$1" = "--help" ]; then exit 0; fi`,
          `echo $$ >> '${pids}'`,
          "exec sleep 30",
          "",
        ].join("\n"),
      );
      chmodSync(join(bin, command), 0o755);
    }
    const { script } = recorder("notice-exit");
    const run = await start({ BROWSER: script, PATH: `${bin}:${process.env.PATH ?? ""}` });
    await run.call("ask", plainChoiceAsk("notice-exit"));
    await waitFor(() => lines(pids).length === 1, "the notifier's start");
    const pid = Number(lines(pids)[0]);
    expect(() => process.kill(pid, 0)).not.toThrow();
    run.emit("SIGTERM");
    expect(await run.session.ended).toBe(0);
    await waitFor(() => {
      try {
        process.kill(pid, 0);
        return false;
      } catch {
        return true;
      }
    }, "the notifier's end");
  });
});
