import { afterEach, describe, expect, test } from "bun:test";
import { accessSync, constants } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PLAIN_CHOICE } from "@askboard/contract/fixtures";
import {
  LINK_RECORDER,
  LINKS_VARIABLE,
  parseOpened,
  readOpened,
  waitForOpened,
} from "./link-recorder.ts";

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

const scratch = async () => {
  const dir = await mkdtemp(join(tmpdir(), "askboard-recorder-test-"));
  dirs.push(dir);
  return join(dir, "links");
};

// The recorder as the notifier starts it: one command, an argument vector, no shell (AD-8).
const record = async (args: readonly string[], env: Record<string, string>) => {
  const child = Bun.spawn([LINK_RECORDER, ...args], { env, stdout: "pipe", stderr: "pipe" });
  return child.exited;
};

describe("the link recorder script", () => {
  test("is an executable file, as BROWSER must name one", () => {
    expect(() => accessSync(LINK_RECORDER, constants.X_OK)).not.toThrow();
  });

  test("appends each link it is given, with its argument count, to the file named", async () => {
    const file = await scratch();
    const tricky = `${PLAIN_CHOICE.link}&x=$(touch pwned);echo`;
    expect(await record([PLAIN_CHOICE.link], { [LINKS_VARIABLE]: file })).toBe(0);
    expect(await record([tricky], { [LINKS_VARIABLE]: file })).toBe(0);
    expect(await record(["one", "two"], { [LINKS_VARIABLE]: file })).toBe(0);
    expect(await readOpened(file)).toEqual([
      { args: 1, link: PLAIN_CHOICE.link },
      { args: 1, link: tricky },
      { args: 2, link: "one two" },
    ]);
  });

  test("opens nothing and succeeds when no file is named, as a job-wide BROWSER", async () => {
    expect(await record([PLAIN_CHOICE.link], {})).toBe(0);
  });
});

describe("parseOpened", () => {
  test("reads one call per line and skips blank lines", () => {
    expect(parseOpened("1\thttp://a\n\n0\t\n")).toEqual([
      { args: 1, link: "http://a" },
      { args: 0, link: "" },
    ]);
  });
});

describe("waitForOpened", () => {
  test("is nothing yet before the first call", async () => {
    expect(await readOpened(await scratch())).toEqual([]);
  });

  test("returns the calls once there are as many as asked for", async () => {
    const file = await scratch();
    setTimeout(() => void Bun.write(file, "1\thttp://a\n"), 100);
    expect(await waitForOpened(file, 1, 2_000)).toEqual([{ args: 1, link: "http://a" }]);
  });

  test("fails after the bound, saying how many boards were opened", async () => {
    const file = await scratch();
    await Bun.write(file, "1\thttp://a\n");
    await expect(waitForOpened(file, 2, 200)).rejects.toThrow(
      "the session process opened 1 board(s) through BROWSER within 0.2 s, not 2",
    );
  });
});
