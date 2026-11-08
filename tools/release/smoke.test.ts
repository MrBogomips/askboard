import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { assemble } from "./assemble.ts";
import { runSmoke, smoke } from "./smoke.ts";
import { toolNames } from "./tool-names.ts";

// The release smoke (plugin-release, design decision 6; packaging spec, "The release workflow"): on a
// tree, the start script on Node answers `initialize` with the tree's version, lists the expected
// tools, ends with its input, and the hook mode exits 0. Most cases run on a fake tree whose bundle
// is a small stand-in, so they need no build; one assembles the real tree when a build exists.

const ROOT = join(import.meta.dir, "..", "..");
const TOOLS = ["ask", "update", "collect", "fetch", "snapshot"];

// Node 24.22.1 or later: the machine's own, read from the repository (a version manager's pin).
const realNode = ((): string | undefined => {
  const probe = Bun.spawnSync(["node", "-p", 'process.versions.node + " " + process.execPath'], {
    cwd: ROOT,
    stderr: "pipe",
  })
    .stdout.toString()
    .trim();
  const at = probe.indexOf(" ");
  const [major = 0, minor = 0, patch = 0] = probe.slice(0, at).split(".").map(Number);
  const usable =
    at > 0 && (major > 24 || (major === 24 && (minor > 22 || (minor === 22 && patch >= 1))));
  return usable ? probe.slice(at + 1) : undefined;
})();

const folders: string[] = [];
const folder = (prefix = "askboard-smoke-"): string => {
  const made = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  folders.push(made);
  return made;
};
// The processes whose command line names `path`: a smoke run must leave none behind.
const processesUnder = (path: string): number[] =>
  Bun.spawnSync(["pgrep", "-f", path])
    .stdout.toString()
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map(Number);

// Waits up to two seconds for `path`'s processes to end; kills and names those still running.
const leftOver = async (path: string): Promise<number[]> => {
  const deadline = Date.now() + 2000;
  let running = processesUnder(path);
  while (running.length > 0 && Date.now() < deadline) {
    await Bun.sleep(50);
    running = processesUnder(path);
  }
  for (const pid of running) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
  return running;
};

afterEach(async () => {
  const made = folders.splice(0);
  const running = (await Promise.all(made.map(leftOver))).flat();
  for (const path of made) rmSync(path, { recursive: true, force: true });
  // A test that leaves a process running fails, so a leak cannot pile up across runs of the check.
  expect(running).toEqual([]);
});

// A stand-in bundle: the MCP handshake and `tools/list` as the environment says, `hook` reading its
// input and exiting with `STANDIN_HOOK_EXIT`, and an end at the end of input unless told to stay.
const STAND_IN = `
import { createInterface } from "node:readline";
const [mode] = process.argv.slice(2);
if (mode === "hook") {
  process.stdin.resume();
  process.stdin.on("end", () => process.exit(Number(process.env.STANDIN_HOOK_EXIT ?? 0)));
} else if (process.env.STANDIN_SILENT !== "1") {
  const tools = JSON.parse(process.env.STANDIN_TOOLS ?? "[]").map((name) => ({ name }));
  const reader = createInterface({ input: process.stdin });
  reader.on("line", (line) => {
    const message = JSON.parse(line);
    if (message.id === undefined) return;
    const result = message.method === "initialize"
      ? { protocolVersion: "2025-06-18", capabilities: { tools: {} },
          serverInfo: { name: process.env.STANDIN_NAME ?? "askboard", version: process.env.STANDIN_VERSION ?? "9.8.7" } }
      : message.method === "tools/list" ? { tools } : {};
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: message.id, result }) + "\\n");
  });
}
if (process.env.STANDIN_STAY === "1") setInterval(() => {}, 1000);
`;

/** A fake tree: the real start script, the stand-in bundle and a manifest of version 9.8.7. */
const fakeTree = (): string => {
  const tree = folder();
  for (const path of ["scripts", "dist", ".claude-plugin"]) mkdirSync(join(tree, path));
  copyFileSync(join(ROOT, "scripts", "askboard"), join(tree, "scripts", "askboard"));
  writeFileSync(join(tree, "dist", "askboard.mjs"), STAND_IN);
  writeFileSync(
    join(tree, ".claude-plugin", "plugin.json"),
    `${JSON.stringify({ name: "askboard", version: "9.8.7" })}\n`,
  );
  return tree;
};

// The start script needs Node 24.22.1 or later first on PATH, whatever the machine's own PATH holds.
const nodeFirst = (): string => `${join(realNode ?? "node", "..")}:${process.env.PATH ?? ""}`;
const nodeTest = test.skipIf(realNode === undefined);

const standIn = (overrides: Record<string, string> = {}): Record<string, string> => ({
  PATH: nodeFirst(),
  STANDIN_TOOLS: JSON.stringify(TOOLS),
  ...overrides,
});

const failed = (steps: { name: string; ok: boolean; detail: string }[]) =>
  steps.filter((step) => !step.ok);

describe("smoke on a fake tree", () => {
  nodeTest("passes: the handshake, the version, the tools, a clean end and the hook", async () => {
    const steps = await smoke(fakeTree(), { tools: TOOLS, env: standIn() });
    expect(steps.map((step) => step.name)).toEqual([
      "initialize",
      "version",
      "tools",
      "exit",
      "hook",
    ]);
    expect(failed(steps)).toEqual([]);
  });

  nodeTest(
    "a tree named by a relative path is found, though the processes run elsewhere",
    async () => {
      const tree = fakeTree();
      const here = process.cwd();
      process.chdir(join(tree, ".."));
      try {
        const steps = await smoke(basename(tree), { tools: TOOLS, env: standIn() });
        expect(failed(steps)).toEqual([]);
      } finally {
        process.chdir(here);
      }
    },
  );

  nodeTest("the tool names are compared as a set, in any order", async () => {
    const steps = await smoke(fakeTree(), {
      tools: [...TOOLS].reverse(),
      env: standIn(),
    });
    expect(failed(steps)).toEqual([]);
  });

  nodeTest(
    "fails the version step, naming both versions, when the server reports another",
    async () => {
      const steps = await smoke(fakeTree(), {
        tools: TOOLS,
        env: standIn({ STANDIN_VERSION: "0.0.1" }),
      });
      const [step, ...others] = failed(steps);
      expect(step?.name).toBe("version");
      expect(step?.detail).toContain("0.0.1");
      expect(step?.detail).toContain("9.8.7");
      expect(others).toEqual([]);
    },
  );

  nodeTest("fails the initialize step when the server is not named askboard", async () => {
    const steps = await smoke(fakeTree(), {
      tools: TOOLS,
      env: standIn({ STANDIN_NAME: "other" }),
    });
    expect(failed(steps)[0]?.name).toBe("initialize");
    expect(failed(steps)[0]?.detail).toContain("other");
  });

  nodeTest(
    "fails the tools step naming a tool that is missing and one that is not expected",
    async () => {
      const steps = await smoke(fakeTree(), {
        tools: TOOLS,
        env: standIn({
          STANDIN_TOOLS: JSON.stringify(["ask", "update", "collect", "fetch", "extra"]),
        }),
      });
      const step = failed(steps)[0];
      expect(step?.name).toBe("tools");
      expect(step?.detail).toContain("snapshot");
      expect(step?.detail).toContain("extra");
    },
  );

  nodeTest(
    "fails the tools step when no tool is expected: an empty list proves nothing",
    async () => {
      const steps = await smoke(fakeTree(), { tools: [], env: standIn() });
      expect(failed(steps)[0]?.name).toBe("tools");
    },
  );

  nodeTest("fails the exit step when the server does not end with its input", async () => {
    const steps = await smoke(fakeTree(), {
      tools: TOOLS,
      timeoutMs: 1500,
      env: standIn({ STANDIN_STAY: "1" }),
    });
    expect(failed(steps).map((step) => step.name)).toEqual(["exit"]);
  });

  nodeTest(
    "fails the hook step, naming the exit code, when the hook mode exits non-zero",
    async () => {
      const steps = await smoke(fakeTree(), {
        tools: TOOLS,
        env: standIn({ STANDIN_HOOK_EXIT: "3" }),
      });
      const step = failed(steps)[0];
      expect(step?.name).toBe("hook");
      expect(step?.detail).toContain("3");
    },
  );

  nodeTest(
    "fails the initialize step naming it, and stops, when the bundle is removed",
    async () => {
      const tree = fakeTree();
      rmSync(join(tree, "dist", "askboard.mjs"));
      const steps = await smoke(tree, { tools: TOOLS, env: standIn(), timeoutMs: 5000 });
      expect(failed(steps)[0]?.name).toBe("initialize");
      expect(steps.map((step) => step.name)).not.toContain("tools");
      // The hook mode runs on its own and fails too: the bundle is gone for it as well.
      expect(steps.at(-1)?.name).toBe("hook");
      expect(steps.at(-1)?.ok).toBe(false);
    },
  );

  nodeTest("fails the initialize step when the server never answers", async () => {
    const steps = await smoke(fakeTree(), {
      tools: TOOLS,
      timeoutMs: 800,
      env: standIn({ STANDIN_SILENT: "1", STANDIN_STAY: "1" }),
    });
    expect(failed(steps)[0]?.name).toBe("initialize");
    expect(failed(steps)[0]?.detail).toContain("no answer");
  });

  nodeTest("a failed initialize ends the server it started: no process is left", async () => {
    const tree = fakeTree();
    await smoke(tree, {
      tools: TOOLS,
      timeoutMs: 800,
      env: standIn({ STANDIN_SILENT: "1", STANDIN_STAY: "1" }),
    });
    expect(await leftOver(tree)).toEqual([]);
  });

  nodeTest("a server with another name is ended too: no process is left", async () => {
    const tree = fakeTree();
    const steps = await smoke(tree, {
      tools: TOOLS,
      env: standIn({ STANDIN_NAME: "other", STANDIN_STAY: "1" }),
    });
    expect(failed(steps)[0]?.name).toBe("initialize");
    expect(await leftOver(tree)).toEqual([]);
  });

  nodeTest(
    "fails the initialize step when the tree has no plugin manifest to compare with",
    async () => {
      const tree = fakeTree();
      rmSync(join(tree, ".claude-plugin", "plugin.json"));
      const steps = await smoke(tree, { tools: TOOLS, env: standIn() });
      expect(failed(steps)[0]?.name).toBe("version");
      expect(failed(steps)[0]?.detail).toContain("plugin.json");
    },
  );

  nodeTest("leaves nothing in the tree and no session folder behind", async () => {
    const tree = fakeTree();
    const before = Bun.spawnSync(["find", tree]).stdout.toString();
    await smoke(tree, { tools: TOOLS, env: standIn() });
    expect(Bun.spawnSync(["find", tree]).stdout.toString()).toBe(before);
  });
});

describe("runSmoke, the command line", () => {
  const run = async (argv: string[], env: Record<string, string> = standIn()) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runSmoke(argv, {
      env,
      stdout: (line) => void out.push(line),
      stderr: (line) => void err.push(line),
    });
    return { code, out, err };
  };

  const toolsFile = (names: string[] = TOOLS): string => {
    const file = join(folder(), "tools.json");
    writeFileSync(file, JSON.stringify(names));
    return file;
  };

  nodeTest("exits 0 and prints one line per step when all pass", async () => {
    const ran = await run([fakeTree(), "--tools", toolsFile()]);
    expect(ran.code).toBe(0);
    expect(ran.out).toHaveLength(5);
    expect(ran.out.every((line) => line.startsWith("smoke: "))).toBe(true);
    expect(ran.err).toEqual([]);
  });

  nodeTest("exits 1 and names the failed step on stderr", async () => {
    const ran = await run(
      [fakeTree(), "--tools", toolsFile()],
      standIn({ STANDIN_VERSION: "1.0.0" }),
    );
    expect(ran.code).toBe(1);
    expect(ran.err.join("\n")).toContain("version");
  });

  nodeTest.each([
    ["no arguments", []],
    ["no tools file", ["TREE"]],
    ["a tools file that does not exist", ["TREE", "--tools", "/nonexistent/tools.json"]],
  ])("exits 2 for %s", async (_name, argv) => {
    const tree = fakeTree();
    const ran = await run(argv.map((argument) => (argument === "TREE" ? tree : argument)));
    expect(ran.code).toBe(2);
    expect(ran.err.join("\n")).toContain("smoke:");
  });

  nodeTest("exits 2 for a tools file that is not an array of names", async () => {
    const file = join(folder(), "tools.json");
    writeFileSync(file, '{"ask":true}');
    const ran = await run([fakeTree(), "--tools", file]);
    expect(ran.code).toBe(2);
  });
});

describe("the smoke as the Linux job runs it: plain Node, no dependency", () => {
  test.skipIf(realNode === undefined)(
    "node runs smoke.ts from an empty folder, with no node_modules",
    async () => {
      const tree = fakeTree();
      const work = folder();
      const file = join(work, "tools.json");
      writeFileSync(file, JSON.stringify(TOOLS));
      const nodeBinary = realNode ?? "node";
      const child = Bun.spawn(
        [nodeBinary, join(ROOT, "tools", "release", "smoke.ts"), tree, "--tools", file],
        {
          cwd: work,
          env: { ...standIn(), PATH: `${join(nodeBinary, "..")}:/usr/bin:/bin` },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect(stderr.split("\n").filter((line) => !line.includes("ExperimentalWarning"))).toEqual([
        "",
      ]);
      expect(stdout.split("\n").filter(Boolean)).toHaveLength(5);
      expect(code).toBe(0);
    },
    30_000,
  );

  test("smoke.ts imports nothing but Node's own modules", async () => {
    const text = await Bun.file(join(ROOT, "tools", "release", "smoke.ts")).text();
    const imports = [...text.matchAll(/^import .* from "([^"]+)"/gm)].map((match) => match[1]);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.filter((name) => !name?.startsWith("node:"))).toEqual([]);
  });
});

describe("the real tree", () => {
  const bundle = join(ROOT, "dist", "askboard.mjs");
  const mod = join(ROOT, "hooks", "askboard-mod.js");
  const missing = !existsSync(bundle) || !existsSync(mod) ? "run bun run build" : null;
  if (missing !== null) process.stderr.write(`smoke.test.ts: real tree skipped, ${missing}\n`);

  test.skipIf(missing !== null || realNode === undefined)(
    "the tree of the assembly answers the handshake with the five tools on Node",
    async () => {
      // A checkout of what the assembly reads, with a CHANGELOG of its own (task 4.2 writes the real one).
      const checkout = folder("askboard-smoke-checkout-");
      for (const path of [
        "dist",
        "hooks",
        "scripts",
        "skills",
        ".claude-plugin",
        "LICENSE",
        "README.md",
      ]) {
        cpSync(join(ROOT, path), join(checkout, path), { recursive: true });
      }
      rmSync(join(checkout, ".claude-plugin", "marketplace.json"), { force: true });
      writeFileSync(join(checkout, "CHANGELOG.md"), "# Changelog\n\n## 0.1.0 - 2026-11-07\n");
      for (const path of ["package.json"]) copyFileSync(join(ROOT, path), join(checkout, path));
      chmodSync(join(checkout, "scripts", "askboard"), 0o755);
      const tree = join(folder(), "tree");
      await assemble(checkout, tree, { notices: async () => "notices\n" });
      const steps = await smoke(tree, {
        tools: toolNames(),
        env: { PATH: nodeFirst() },
        timeoutMs: 30_000,
      });
      expect(failed(steps)).toEqual([]);
      expect(steps).toHaveLength(5);
    },
    90_000,
  );
});
