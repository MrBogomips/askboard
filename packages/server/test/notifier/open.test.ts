import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNotifier, onPathOf, type Spawn } from "../../src/notifier/index.ts";

// Board-host spec, Opening a board in the browser (task 6.5): the opener starts with an argument
// vector, never through a shell, returns at once and never throws; with `spawn` faked, then once
// for real with a recorder script as `BROWSER`.

const LINK = "http://127.0.0.1:47213/b/order-db-choice-x7k2?t=pV3xK9qLmT2wR7nB4cYh8A";
// What a shell would expand, split or run, were one to parse the link.
// biome-ignore lint/suspicious/noTemplateCurlyInString: a shell expansion is the point
const HOSTILE = "http://127.0.0.1:47213/b/x;touch${IFS}/tmp/pwned?t=$(id)`id`&a=b|c>d 'e\"f";

type Spawned = { command: string; args: readonly string[]; options: object };

const fakeSpawn = (behaviour: "ok" | "throws" | "fails" = "ok") => {
  const spawned: Spawned[] = [];
  const unrefs: number[] = [];
  const spawn: Spawn = (command, args, options) => {
    if (behaviour === "throws") throw new Error("spawn EACCES");
    spawned.push({ command, args, options });
    return {
      on: (event, listener) => {
        if (event === "error" && behaviour === "fails") {
          queueMicrotask(() =>
            listener(Object.assign(new Error("spawn x ENOENT"), { code: "ENOENT" })),
          );
        }
      },
      unref: () => unrefs.push(1),
    };
  };
  return { spawn, spawned, unrefs };
};

const macOS = (env: Readonly<Record<string, string>> = {}) => ({
  platform: "darwin",
  env,
  exists: () => false,
  onPath: (command: string) => command === "open",
});

describe("the opener", () => {
  test("runs open with the link as its one argument, detached, without a shell", () => {
    const { spawn, spawned, unrefs } = fakeSpawn();
    const reported: unknown[] = [];
    createNotifier({ ...macOS(), spawn, report: (error) => reported.push(error) }).open(LINK);
    expect(spawned).toEqual([
      { command: "open", args: [LINK], options: { shell: false, detached: true, stdio: "ignore" } },
    ]);
    expect(unrefs).toEqual([1]);
    expect(reported).toEqual([]);
  });

  test("passes a link holding shell metacharacters as one argument, unchanged", () => {
    const { spawn, spawned } = fakeSpawn();
    createNotifier({ ...macOS(), spawn, report: () => undefined }).open(HOSTILE);
    expect(spawned[0]?.args).toEqual([HOSTILE]);
    expect(spawned[0]?.options).toMatchObject({ shell: false });
  });

  test("takes BROWSER as one command, never split", () => {
    const { spawn, spawned } = fakeSpawn();
    const env = { BROWSER: "firefox --new-tab" };
    createNotifier({ ...macOS(env), spawn, report: () => undefined }).open(LINK);
    expect(spawned[0]?.command).toBe("firefox --new-tab");
    expect(spawned[0]?.args).toEqual([LINK]);
  });

  test("reports a start that throws or fails, and returns normally", async () => {
    for (const behaviour of ["throws", "fails"] as const) {
      const { spawn } = fakeSpawn(behaviour);
      const reported: unknown[] = [];
      const notifier = createNotifier({ ...macOS(), spawn, report: (e) => reported.push(e) });
      expect(() => notifier.open(LINK)).not.toThrow();
      await Bun.sleep(1);
      expect(reported).toHaveLength(1);
    }
  });

  test("opens nothing, and reports it, when no board can be shown at the open", () => {
    const { spawn, spawned } = fakeSpawn();
    const reported: unknown[] = [];
    const notifier = createNotifier({
      ...macOS({ SSH_TTY: "/dev/pts/1" }),
      spawn,
      report: (error) => reported.push(error),
    });
    notifier.open(LINK);
    expect(spawned).toEqual([]);
    expect(reported).toHaveLength(1);
    expect(String((reported[0] as { code?: string }).code)).toBe("NO_BOARD_OPENER");
  });
});

describe("the check", () => {
  test("says a board can be shown, naming no opener", async () => {
    const notifier = createNotifier({ ...macOS(), report: () => undefined });
    expect(await notifier.check()).toEqual({ showable: true });
  });

  test("says why not, with the reason and a detail", async () => {
    const notifier = createNotifier({ ...macOS({ CI: "true" }), report: () => undefined });
    expect(await notifier.check()).toEqual({
      showable: false,
      reason: "ci",
      detail: expect.stringContaining("CI") as unknown as string,
    });
  });
});

const folder = mkdtempSync(join(tmpdir(), "askboard-opener-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

describe("PATH lookup", () => {
  test("finds an executable file in a PATH folder, and nothing else", () => {
    const tool = join(folder, "opener-tool");
    writeFileSync(tool, "#!/bin/sh\n");
    chmodSync(tool, 0o755);
    const plain = join(folder, "not-executable");
    writeFileSync(plain, "");
    const onPath = onPathOf({ PATH: `/nowhere::${folder}` });
    expect(onPath("opener-tool")).toBe(true);
    expect(onPath("not-executable")).toBe(false);
    expect(onPath("missing")).toBe(false);
    expect(onPathOf({})("opener-tool")).toBe(false);
  });
});

describe("a real run", () => {
  test("the BROWSER recorder receives the link as its only argument", async () => {
    const record = join(folder, "argv.txt");
    const recorder = join(folder, "recorder.sh");
    writeFileSync(
      recorder,
      `#!/bin/sh\nprintf '%s\\n' "$#" "$@" > '${record}.part'\nmv '${record}.part' '${record}'\n`,
    );
    chmodSync(recorder, 0o755);
    const reported: unknown[] = [];
    const notifier = createNotifier({
      platform: process.platform,
      env: { PATH: process.env.PATH ?? "", BROWSER: recorder },
      // Inside a container the rule shows no board, so the run there skips the marker files.
      ...(existsSync("/.dockerenv") || existsSync("/run/.containerenv")
        ? { exists: () => false }
        : {}),
      report: (error) => reported.push(error),
    });
    expect(await notifier.check()).toEqual({ showable: true });
    notifier.open(HOSTILE);
    for (let tries = 0; tries < 200 && !existsSync(record); tries += 1) await Bun.sleep(10);
    expect(readFileSync(record, "utf8")).toBe(`1\n${HOSTILE}\n`);
    expect(existsSync("/tmp/pwned")).toBe(false);
    expect(reported).toEqual([]);
  });
});
