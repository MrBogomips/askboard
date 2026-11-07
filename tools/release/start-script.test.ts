import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The start script (plugin-release, design decision 1; packaging spec, "The start script runs the
// bundle on Node"). Every test runs it under /bin/sh with shim `node` executables first on PATH, in
// a temporary plugin folder; only the last one runs the real bundle on the machine's Node.

const ROOT = join(import.meta.dir, "..", "..");
const SCRIPT = join(ROOT, "scripts", "askboard");
const BUNDLE = join(ROOT, "dist", "askboard.mjs");
const SYSTEM_PATH = "/usr/bin:/bin";

const folders: string[] = [];
const folder = (prefix = "askboard-start-"): string => {
  const made = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  folders.push(made);
  return made;
};

afterEach(() => {
  for (const path of folders.splice(0)) rmSync(path, { recursive: true, force: true });
});

/** A `node` that answers `-p` with `version` and otherwise records its parent PID and arguments. */
const shimNode = (into: string): string => {
  mkdirSync(into, { recursive: true });
  const shim = join(into, "node");
  writeFileSync(
    shim,
    [
      "#!/bin/sh",
      'if [ "$1" = "-p" ]; then printf \'%s\\n\' "$SHIM_VERSION"; exit 0; fi',
      '{ printf \'ppid=%s\\n\' "$PPID"; for a in "$@"; do printf \'arg=%s\\n\' "$a"; done; } > "$SHIM_LOG"',
      "",
    ].join("\n"),
  );
  chmodSync(shim, 0o755);
  return into;
};

/** A plugin folder with the start script and a stand-in bundle; its path is the physical one. */
const pluginRoot = (parent = folder()): string => {
  const root = join(parent, "plugin");
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "dist"), { recursive: true });
  copyFileSync(SCRIPT, join(root, "scripts", "askboard"));
  writeFileSync(join(root, "dist", "askboard.mjs"), "// stand-in\n");
  return root;
};

type Ran = {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly recorded: string[];
};

/** Runs `sh <script> <args>` with the shim first on PATH reporting `version`. */
const runScript = async (
  script: string,
  args: string[],
  options: { version: string; shims?: string } = { version: "24.22.1" },
): Promise<Ran> => {
  const shims = options.shims ?? shimNode(folder());
  const log = join(folder(), "shim.log");
  const child = Bun.spawn(["/bin/sh", script, ...args], {
    env: { PATH: `${shims}:${SYSTEM_PATH}`, SHIM_VERSION: options.version, SHIM_LOG: log },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  const recorded = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  return { code, stdout, stderr, recorded };
};

const argsOf = (recorded: string[]): string[] =>
  recorded.filter((line) => line.startsWith("arg=")).map((line) => line.slice(4));

describe("the start script's text", () => {
  test("is POSIX sh with no syntax error", () => {
    expect(existsSync(SCRIPT)).toBe(true);
    expect(readFileSync(SCRIPT, "utf8").split("\n")[0]).toBe("#!/bin/sh");
    const check = Bun.spawnSync(["/bin/sh", "-n", SCRIPT], { stderr: "pipe" });
    expect(check.stderr.toString()).toBe("");
    expect(check.exitCode).toBe(0);
  });

  const shellcheck = Bun.which("shellcheck");
  test.skipIf(shellcheck === null)("shellcheck reports nothing", () => {
    const check = Bun.spawnSync([shellcheck ?? "shellcheck", "-s", "sh", SCRIPT], {
      stdout: "pipe",
    });
    expect(check.stdout.toString()).toBe("");
    expect(check.exitCode).toBe(0);
  });

  test("uses no network client", () => {
    expect(readFileSync(SCRIPT, "utf8")).not.toMatch(/\b(curl|wget|nc|ssh)\b/);
  });
});

describe("a Node that is recent enough", () => {
  test.each(["24.22.1", "24.23.0", "24.100.0", "25.0.0", "26.0.0", "100.0.0"])(
    "node %s runs the bundle with the arguments unchanged, as the script's own replacement",
    async (version) => {
      const root = pluginRoot();
      const ran = await runScript(join(root, "scripts", "askboard"), ["hook", "PreToolUse"], {
        version,
      });
      expect(ran.code).toBe(0);
      expect(argsOf(ran.recorded)).toEqual([
        join(root, "dist", "askboard.mjs"),
        "hook",
        "PreToolUse",
      ]);
      // exec: the shim's parent is the script's parent, this test process (AD-5).
      expect(ran.recorded).toContain(`ppid=${process.pid}`);
    },
  );

  test("no argument starts the bundle with none", async () => {
    const root = pluginRoot();
    const ran = await runScript(join(root, "scripts", "askboard"), []);
    expect(argsOf(ran.recorded)).toEqual([join(root, "dist", "askboard.mjs")]);
  });

  test("arguments with spaces, quotes and glob characters survive", async () => {
    const root = pluginRoot();
    const args = ["client", "/a path/with spaces", '{"a": "b c"}', "*", "it's", "-n"];
    const ran = await runScript(join(root, "scripts", "askboard"), args);
    expect(argsOf(ran.recorded).slice(1)).toEqual(args);
  });

  test("the root resolves through a symlinked folder", async () => {
    const parent = folder();
    const root = pluginRoot(parent);
    symlinkSync(root, join(parent, "linked"));
    const ran = await runScript(join(parent, "linked", "scripts", "askboard"), ["x"]);
    expect(argsOf(ran.recorded)).toEqual([join(root, "dist", "askboard.mjs"), "x"]);
  });

  test("the root resolves through a symlink to the script, absolute and relative", async () => {
    const parent = folder();
    const root = pluginRoot(parent);
    mkdirSync(join(parent, "bin"));
    symlinkSync(join(root, "scripts", "askboard"), join(parent, "bin", "absolute"));
    symlinkSync("../plugin/scripts/askboard", join(parent, "bin", "relative"));
    for (const name of ["absolute", "relative"]) {
      const ran = await runScript(join(parent, "bin", name), ["x"]);
      expect(argsOf(ran.recorded)).toEqual([join(root, "dist", "askboard.mjs"), "x"]);
    }
  });

  test("the root resolves in a path with spaces", async () => {
    const root = pluginRoot(join(folder(), "a folder with spaces"));
    const ran = await runScript(join(root, "scripts", "askboard"), ["x"]);
    expect(argsOf(ran.recorded)).toEqual([join(root, "dist", "askboard.mjs"), "x"]);
  });

  test("a relative call path resolves", async () => {
    const root = pluginRoot();
    const shims = shimNode(folder());
    const log = join(folder(), "shim.log");
    const child = Bun.spawn(["/bin/sh", "scripts/askboard", "x"], {
      cwd: root,
      env: { PATH: `${shims}:${SYSTEM_PATH}`, SHIM_VERSION: "24.22.1", SHIM_LOG: log },
    });
    await child.exited;
    expect(argsOf(readFileSync(log, "utf8").split("\n"))).toEqual([
      join(root, "dist", "askboard.mjs"),
      "x",
    ]);
  });
});

describe("a Node that is too old", () => {
  test.each(["24.22.0", "24.9.9", "22.11.0", "23.99.9", "9.99.99", "0.0.1"])(
    "node %s does not run the bundle",
    async (version) => {
      const root = pluginRoot();
      const ran = await runScript(join(root, "scripts", "askboard"), ["hook", "PreToolUse"], {
        version,
      });
      expect(ran.recorded).toEqual([]);
    },
  );

  test.each(["", "v24.22.1", "twenty-four", "24.22", "24.22.1.1", "24.22.x"])(
    "a version output of %p does not run the bundle",
    async (version) => {
      const root = pluginRoot();
      const ran = await runScript(join(root, "scripts", "askboard"), ["hook", "PreToolUse"], {
        version,
      });
      expect(ran.recorded).toEqual([]);
    },
  );
});

describe("the real bundle", () => {
  const nodeVersion = Bun.spawnSync(["node", "-p", "process.versions.node"], {
    cwd: ROOT,
    stderr: "pipe",
  })
    .stdout.toString()
    .trim();
  const [major = 0, minor = 0, patch = 0] = nodeVersion.split(".").map(Number);
  const usable = major > 24 || (major === 24 && (minor > 22 || (minor === 22 && patch >= 1)));
  const missing = !existsSync(BUNDLE) ? "dist/askboard.mjs is missing: run bun run build" : null;
  if (missing !== null)
    process.stderr.write(`start-script.test.ts: real run skipped, ${missing}\n`);
  if (!usable)
    process.stderr.write(`start-script.test.ts: real run skipped, node is ${nodeVersion}\n`);

  test.skipIf(missing !== null || !usable)(
    "answers initialize and lists ask on the machine's Node",
    async () => {
      const project = folder("askboard-start-project-");
      const child = Bun.spawn(["/bin/sh", SCRIPT], {
        cwd: ROOT,
        env: {
          ...process.env,
          XDG_RUNTIME_DIR: undefined,
          TMPDIR: project,
          CLAUDE_PROJECT_DIR: project,
        },
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });
      const lines = [
        {
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "start-script-test", version: "0" },
          },
        },
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
      ];
      child.stdin.write(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
      child.stdin.flush();
      const answers: Record<
        number,
        { result?: { serverInfo?: { name: string }; tools?: { name: string }[] } }
      > = {};
      const reader = child.stdout.getReader();
      let buffered = "";
      const deadline = Date.now() + 20_000;
      while (Object.keys(answers).length < 2 && Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered += new TextDecoder().decode(value);
        for (const line of buffered.split("\n").slice(0, -1)) {
          const message = JSON.parse(line);
          if (typeof message.id === "number") answers[message.id] = message;
        }
        buffered = buffered.slice(buffered.lastIndexOf("\n") + 1);
      }
      child.stdin.end();
      const exited = await Promise.race([child.exited, Bun.sleep(10_000).then(() => "timeout")]);
      if (exited === "timeout") child.kill();
      expect(answers[1]?.result?.serverInfo?.name).toBe("askboard");
      expect(answers[2]?.result?.tools?.map((tool) => tool.name)).toContain("ask");
      expect(exited).toBe(0);
    },
    40_000,
  );
});
