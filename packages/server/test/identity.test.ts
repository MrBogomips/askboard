import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { type Run, runCommand, systemIdentity } from "../src/identity.ts";

// The `Identity` adapter of the session process entry point (task 7.2; core spec, Who and when):
// the session project's git user name, read with an argument vector, and the login name.

const folder = mkdtempSync(join(tmpdir(), "askboard-identity-"));
afterAll(() => rmSync(folder, { recursive: true, force: true }));

// Git with no system or global configuration, so only the folder's own counts.
const isolated = {
  PATH: process.env.PATH ?? "",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
  HOME: folder,
};

const git = (...args: string[]) => {
  const run = Bun.spawnSync(["git", ...args], { cwd: folder, env: isolated });
  if (run.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.toString()}`);
};

describe("the git user name", () => {
  test("runs git config with an argument vector in the project folder", async () => {
    const calls: Parameters<Run>[] = [];
    const run: Run = async (...args) => {
      calls.push(args);
      return "Paola Greco\n";
    };
    const identity = systemIdentity({ projectDir: "/work/project", env: { A: "1" }, run });
    expect(await identity.gitUserName()).toBe("Paola Greco");
    expect(calls).toEqual([
      ["git", ["config", "--get", "user.name"], { cwd: "/work/project", env: { A: "1" } }],
    ]);
  });

  test("is no name when git has none or an empty one", async () => {
    for (const answer of [undefined, "", "  \n"]) {
      const identity = systemIdentity({ projectDir: folder, env: {}, run: async () => answer });
      expect(await identity.gitUserName()).toBeUndefined();
    }
  });

  test("reads the project's own git configuration", async () => {
    git("init", "--quiet");
    const identity = systemIdentity({ projectDir: folder, env: isolated });
    expect(await identity.gitUserName()).toBeUndefined();
    git("config", "user.name", "Paola Greco");
    expect(await identity.gitUserName()).toBe("Paola Greco");
  });

  test("a git that cannot start rejects, for ask-core to report", async () => {
    const identity = systemIdentity({ projectDir: folder, env: { PATH: "/nonexistent-askboard" } });
    await expect(identity.gitUserName()).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("the login name", () => {
  test("is the operating system's user name", async () => {
    const identity = systemIdentity({ projectDir: folder, env: {} });
    expect(await identity.loginName()).toBe(userInfo().username);
  });
});

describe("running a command", () => {
  test("gives its output, no value on a failing exit, and rejects when it cannot run", async () => {
    const env = { PATH: process.env.PATH ?? "" };
    expect(await runCommand("printf", ["%s", "a b;c"], { cwd: folder, env })).toBe("a b;c");
    expect(await runCommand("false", [], { cwd: folder, env })).toBeUndefined();
    await expect(runCommand("no-such-command-x7k2", [], { cwd: folder, env })).rejects.toThrow();
  });
});
