import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sessionFilePath, sessionFolder } from "@askboard/contract";

// The entry point as Claude Code runs it, a real process over real stdio (tasks 4.2 and 4.7): its
// session file is named by its parent's PID, here this test's, and on stdin's end, SIGINT, SIGTERM
// or SIGHUP the file and the socket are gone once it exits.

const MAIN = join(import.meta.dir, "..", "src", "main.ts");
const runtimes: string[] = [];
afterAll(() => {
  for (const runtime of runtimes) rmSync(runtime, { recursive: true, force: true });
});

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "claude-code", version: "2.1.312" },
  },
};

describe("the entry point's session file", () => {
  for (const how of ["stdin", "SIGINT", "SIGTERM", "SIGHUP"] as const) {
    test(`is written under the parent's PID and gone after ${how}`, async () => {
      const runtime = mkdtempSync("/tmp/abm-");
      runtimes.push(runtime);
      const child = Bun.spawn(["bun", MAIN], {
        env: { PATH: process.env.PATH ?? "", XDG_RUNTIME_DIR: runtime, HOME: runtime },
        cwd: runtime,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      child.stdin.write(`${JSON.stringify(initialize)}\n`);
      child.stdin.flush();
      const folder = sessionFolder({
        env: { XDG_RUNTIME_DIR: runtime },
        uid: process.getuid?.() ?? 0,
      });
      const file = sessionFilePath(folder, process.pid);
      for (let tries = 0; tries < 500 && !existsSync(file); tries += 1) await Bun.sleep(10);
      const session = JSON.parse(readFileSync(file, "utf8"));
      expect(session).toMatchObject({ key: process.pid, pid: child.pid });
      // Started without CLAUDE_PROJECT_DIR: no session project root, and the file names none.
      expect(session).not.toHaveProperty("projectDir");
      expect(existsSync(session.apiAddress)).toBe(true);
      const errBox = { text: "" };
      void (async () => {
        const decoder = new TextDecoder();
        for await (const chunk of child.stderr) errBox.text += decoder.decode(chunk);
      })();
      const run = (cmd: string[]) => {
        const r = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
        return `${r.stdout.toString()}${r.stderr.toString()}`.trimEnd();
      };
      const began = performance.now();
      console.log(`DIAG ${how} ready; PATH=${process.env.PATH}`);
      console.log(run(["lsof", "-p", String(child.pid)]).split("\n").filter((l) => !/ REG | DIR /.test(l)).join("\n"));
      if (how === "stdin") child.stdin.end();
      else child.kill(how);
      const first = await Promise.race([child.exited, Bun.sleep(3500).then(() => "still running")]);
      console.log(`DIAG ${how} after ${Math.round(performance.now() - began)} ms: ${first}; stderr ${JSON.stringify(errBox.text)}`);
      if (first === "still running") {
        console.log(run(["ps", "-axo", "pid,ppid,pgid,stat,sig,sigmask,command"]).split("\n").filter((l) => /bun|node|PID/.test(l)).join("\n"));
        console.log(run(["sample", String(child.pid), "1"]).split("\n").slice(0, 220).join("\n"));
      }
      expect(await child.exited).toBe(0);
      expect(existsSync(file)).toBe(false);
      expect(existsSync(session.apiAddress)).toBe(false);
      await Bun.sleep(50);
      const stderr = errBox.text;
      expect(stderr).toBe(
        `askboard: session ending (${how === "stdin" ? "stdin closed" : how}): 0 open asks discarded\n`,
      );
    });
  }
});
