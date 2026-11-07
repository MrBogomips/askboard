import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sessionFilePath } from "@askboard/contract";

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

/**
 * A `node` that answers the version probe (`-p`) with `version` and its own path, as a real Node
 * prints `process.versions.node` and `process.execPath` (task 1.13), and otherwise records its parent PID and arguments. */
const shimNode = (into: string): string => {
  mkdirSync(into, { recursive: true });
  const shim = join(into, "node");
  writeFileSync(
    shim,
    [
      "#!/bin/sh",
      'if [ "$1" = "-p" ]; then printf \'%s %s\\n\' "$SHIM_VERSION" "$0"; exit 0; fi',
      '{ printf \'ppid=%s\\n\' "$PPID"; for a in "$@"; do printf \'arg=%s\\n\' "$a"; done; } > "$SHIM_LOG"',
      "",
    ].join("\n"),
  );
  chmodSync(shim, 0o755);
  return into;
};

/** A plugin folder with the start script and a stand-in bundle; its path is the physical one. */
const pluginRoot = (parent = folder(), version = "9.8.7"): string => {
  const root = join(parent, "plugin");
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(join(root, "dist"), { recursive: true });
  copyFileSync(SCRIPT, join(root, "scripts", "askboard"));
  writeFileSync(join(root, "dist", "askboard.mjs"), "// stand-in\n");
  mkdirSync(join(root, ".claude-plugin"), { recursive: true });
  writeFileSync(
    join(root, ".claude-plugin", "plugin.json"),
    `${JSON.stringify({ name: "askboard", version }, null, 2)}\n`,
  );
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
  options: {
    version: string;
    shims?: string;
    cwd?: string;
    env?: Record<string, string>;
    /** Bytes written to the script's stdin; none (a closed stdin) when absent. */
    input?: string;
  } = { version: "24.22.1" },
): Promise<Ran> => {
  const shims = options.shims ?? shimNode(folder());
  const log = join(folder(), "shim.log");
  const child = Bun.spawn(["/bin/sh", script, ...args], {
    cwd: options.cwd,
    env: {
      PATH: `${shims}:${SYSTEM_PATH}`,
      SHIM_VERSION: options.version,
      SHIM_LOG: log,
      ...options.env,
    },
    stdin: options.input === undefined ? "ignore" : "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  if (options.input !== undefined) {
    child.stdin?.write(options.input);
    child.stdin?.end();
  }
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

/**
 * A `node` that appends, for every call, its working directory, `CLAUDE_PROJECT_DIR` and a marker
 * when the working directory holds `.volta/hooks.json`, the way a runtime shim would read a
 * project's file (review 1.5, X-1); it answers `-p` with the version.
 */
const projectShimNode = (into: string): string => {
  mkdirSync(into, { recursive: true });
  const shim = join(into, "node");
  writeFileSync(
    shim,
    [
      "#!/bin/sh",
      "{",
      "  printf 'pwd=%s\\n' \"$(pwd -P)\"",
      // A template literal, so the shell's own ${...} is escaped and not read as a placeholder.
      `  printf 'project=%s\\n' "\${CLAUDE_PROJECT_DIR-unset}"`,
      `  printf 'caller=%s\\n' "\${ASKBOARD_CALLER_CWD-unset}"`,
      "  if [ -e ./.volta/hooks.json ]; then printf 'marker=ran in %s\\n' \"$PWD\"; fi",
      '} >> "$SHIM_LOG"',
      'if [ "$1" = "-p" ]; then printf \'%s %s\\n\' "$SHIM_VERSION" "$0"; fi',
      "",
    ].join("\n"),
  );
  chmodSync(shim, 0o755);
  return into;
};

/** A project folder whose files would run a script if a runtime shim read them from there. */
const voltaProject = (): string => {
  const project = folder("askboard-start-project-");
  mkdirSync(join(project, ".volta"));
  writeFileSync(join(project, ".volta", "hooks.json"), '{"node":{"distro":{"bin":"./d.sh"}}}\n');
  writeFileSync(join(project, ".volta", "d.sh"), "#!/bin/sh\n");
  return project;
};

const linesOf = (recorded: string[], key: string): string[] =>
  recorded.filter((line) => line.startsWith(`${key}=`)).map((line) => line.slice(key.length + 1));

describe("the start script runs outside the project (review 1.5, X-1)", () => {
  test.each([[["hook", "PreToolUse"]], [[]]])(
    "node runs in the plugin root, for the version probe and the exec, with args %p",
    async (args) => {
      const root = pluginRoot();
      const project = voltaProject();
      const ran = await runScript(join(root, "scripts", "askboard"), args, {
        version: "24.22.1",
        shims: projectShimNode(folder()),
        cwd: project,
      });
      expect(linesOf(ran.recorded, "pwd")).toEqual([root, root]);
      expect(linesOf(ran.recorded, "marker")).toEqual([]);
    },
  );

  test("the refusal's probe runs in the plugin root too", async () => {
    const root = pluginRoot();
    const ran = await runScript(join(root, "scripts", "askboard"), ["hook", "PreToolUse"], {
      version: "22.11.0",
      shims: projectShimNode(folder()),
      cwd: voltaProject(),
    });
    expect(ran.code).toBe(0);
    expect(linesOf(ran.recorded, "pwd")).toEqual([root]);
    expect(linesOf(ran.recorded, "marker")).toEqual([]);
  });

  test("CLAUDE_PROJECT_DIR unset stays unset for node: no folder stands in for the project (AD-12)", async () => {
    const root = pluginRoot();
    const ran = await runScript(join(root, "scripts", "askboard"), ["x"], {
      version: "24.22.1",
      shims: projectShimNode(folder()),
      cwd: voltaProject(),
    });
    expect(linesOf(ran.recorded, "project")).toEqual(["unset", "unset"]);
  });

  test("an empty CLAUDE_PROJECT_DIR stays empty", async () => {
    const root = pluginRoot();
    const ran = await runScript(join(root, "scripts", "askboard"), ["x"], {
      version: "24.22.1",
      shims: projectShimNode(folder()),
      cwd: voltaProject(),
      env: { CLAUDE_PROJECT_DIR: "" },
    });
    expect(linesOf(ran.recorded, "project")).toEqual(["", ""]);
  });

  test("a CLAUDE_PROJECT_DIR the caller set is kept", async () => {
    const root = pluginRoot();
    const named = folder("askboard-start-named-");
    const ran = await runScript(join(root, "scripts", "askboard"), ["x"], {
      version: "24.22.1",
      shims: projectShimNode(folder()),
      cwd: voltaProject(),
      env: { CLAUDE_PROJECT_DIR: named },
    });
    expect(linesOf(ran.recorded, "project")).toEqual([named, named]);
  });

  test.each([[["hook", "PreToolUse"]], [[]]])(
    "the caller's directory travels as ASKBOARD_CALLER_CWD, for the probe and the exec, with args %p",
    async (args) => {
      const root = pluginRoot();
      const project = voltaProject();
      const ran = await runScript(join(root, "scripts", "askboard"), args, {
        version: "24.22.1",
        shims: projectShimNode(folder()),
        cwd: project,
      });
      expect(linesOf(ran.recorded, "caller")).toEqual([project, project]);
    },
  );

  test("an ASKBOARD_CALLER_CWD from the environment is replaced by the real caller's directory", async () => {
    const root = pluginRoot();
    const project = voltaProject();
    const ran = await runScript(join(root, "scripts", "askboard"), ["x"], {
      version: "24.22.1",
      shims: projectShimNode(folder()),
      cwd: project,
      env: { ASKBOARD_CALLER_CWD: "/somewhere/else" },
    });
    expect(linesOf(ran.recorded, "caller")).toEqual([project, project]);
  });

  test("the script's own text never fills CLAUDE_PROJECT_DIR", () => {
    expect(readFileSync(SCRIPT, "utf8")).not.toMatch(/CLAUDE_PROJECT_DIR\s*=/);
  });

  test("a relative call path from the project still finds the plugin root", async () => {
    const root = pluginRoot();
    const project = join(root, "project");
    mkdirSync(project);
    const ran = await runScript("../scripts/askboard", ["x"], {
      version: "24.22.1",
      shims: shimNode(folder()),
      cwd: project,
    });
    expect(argsOf(ran.recorded)).toEqual([join(root, "dist", "askboard.mjs"), "x"]);
  });
});

/**
 * A `node` for the pass-through tests: the version probe (`-p`) records whatever it finds on its
 * stdin in `$SHIM_PROBE_STDIN` and answers the version; any other run copies its stdin to
 * `$SHIM_STDIN`, writes the marker "from node" to stdout and exits with `$SHIM_EXIT` (0 when unset).
 */
const ioShimNode = (into: string): string => {
  mkdirSync(into, { recursive: true });
  const shim = join(into, "node");
  writeFileSync(
    shim,
    [
      "#!/bin/sh",
      'if [ "$1" = "-p" ]; then cat > "$SHIM_PROBE_STDIN"; printf \'%s %s\\n\' "$SHIM_VERSION" "$0"; exit 0; fi',
      'cat > "$SHIM_STDIN"',
      "printf 'from node\\n'",
      `exit "\${SHIM_EXIT:-0}"`,
      "",
    ].join("\n"),
  );
  chmodSync(shim, 0o755);
  return into;
};

/** Runs the script with the I/O shim, `input` on stdin; the bytes the shim and its probe received. */
const runThrough = async (args: string[], input: string, version = "24.22.1") => {
  const root = pluginRoot();
  const scratch = folder();
  const stdinFile = join(scratch, "stdin");
  const probeFile = join(scratch, "probe");
  const ran = await runScript(join(root, "scripts", "askboard"), args, {
    version,
    shims: ioShimNode(folder()),
    input,
    env: { SHIM_STDIN: stdinFile, SHIM_PROBE_STDIN: probeFile },
  });
  const read = (file: string) => (existsSync(file) ? readFileSync(file, "utf8") : undefined);
  return { ran, received: read(stdinFile), probed: read(probeFile) };
};

// More than a pipe buffer holds (16 to 64 KiB), so that a script that does not hand stdin on whole
// would show.
const BIG = `${JSON.stringify({ tool_input: "x".repeat(100 * 1024) })}\n`;

describe("hook and client modes pass stdin and stdout through (review 1.5, S-3)", () => {
  test.each([
    [["hook", "PreToolUse"]],
    [["client", "/v1/mod/poll", '{"a":1}']],
    [["client", "/v1/mod/poll"]],
  ])("%p: the bytes sent arrive at node whole, and node's output comes back", async (args) => {
    const { ran, received } = await runThrough(args, BIG);
    expect(received).toBe(BIG);
    expect(ran.stdout).toBe("from node\n");
    expect(ran.code).toBe(0);
  });

  test("the version probe does not read the caller's stdin", async () => {
    const { received, probed } = await runThrough(["hook", "PreToolUse"], BIG);
    expect(probed).toBe("");
    expect(received).toBe(BIG);
  });

  test("node's exit code is the script's", async () => {
    const root = pluginRoot();
    const ran = await runScript(join(root, "scripts", "askboard"), ["client", "/x"], {
      version: "24.22.1",
      shims: ioShimNode(folder()),
      input: "",
      env: {
        SHIM_STDIN: join(folder(), "in"),
        SHIM_PROBE_STDIN: join(folder(), "p"),
        SHIM_EXIT: "3",
      },
    });
    expect(ran.code).toBe(3);
  });
});

/** A folder holding only the external tools the script uses: no `node` is on a PATH made of it. */
const toolsWithoutNode = (): string => {
  const into = folder("askboard-start-tools-");
  for (const tool of ["dirname", "readlink", "sed", "awk", "tr", "cut", "head", "cat"]) {
    const found = Bun.which(tool, { PATH: SYSTEM_PATH });
    if (found !== null) symlinkSync(found, join(into, tool));
  }
  return into;
};

type Served = {
  readonly send: (message: unknown | string) => void;
  readonly next: () => Promise<Record<string, unknown>>;
  readonly end: () => Promise<number | null>;
  readonly running: () => boolean;
  readonly stderr: () => Promise<string>;
};

/** Runs the script with no argument as Claude Code does: JSON-RPC lines over stdio. */
const serve = (root: string, env: Record<string, string>): Served => {
  const child = Bun.spawn(["/bin/sh", join(root, "scripts", "askboard")], {
    env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  const reader = child.stdout.getReader();
  let buffered = "";
  const decoder = new TextDecoder();
  const nextLine = async (): Promise<string> => {
    while (!buffered.includes("\n")) {
      const { value, done } = await Promise.race([
        reader.read(),
        Bun.sleep(5000).then(() => ({ value: undefined, done: true })),
      ]);
      if (done || value === undefined)
        throw new Error(`no more output; had ${JSON.stringify(buffered)}`);
      buffered += decoder.decode(value);
    }
    const at = buffered.indexOf("\n");
    const line = buffered.slice(0, at);
    buffered = buffered.slice(at + 1);
    return line;
  };
  return {
    send: (message) => {
      child.stdin.write(`${typeof message === "string" ? message : JSON.stringify(message)}\n`);
      child.stdin.flush();
    },
    next: async () => JSON.parse(await nextLine()),
    end: async () => {
      child.stdin.end();
      return await Promise.race([child.exited, Bun.sleep(5000).then(() => -1)]);
    },
    running: () => child.exitCode === null,
    stderr: () => new Response(child.stderr).text(),
  };
};

const request = (id: unknown, method: string, params?: unknown) => ({
  jsonrpc: "2.0",
  id,
  method,
  ...(params === undefined ? {} : { params }),
});

const INITIALIZE = request(1, "initialize", {
  protocolVersion: "2025-03-26",
  capabilities: {},
  clientInfo: { name: "test", version: "1" },
});

const refusal = (found: string): { node: string; env: Record<string, string> } => {
  if (found === "none") {
    return { node: toolsWithoutNode(), env: {} };
  }
  return {
    node: shimNode(folder()),
    env: { SHIM_VERSION: found, SHIM_LOG: join(folder(), "log") },
  };
};

const refusedSession = (found: string, root = pluginRoot()): { root: string; served: Served } => {
  const { node, env } = refusal(found);
  const path = found === "none" ? node : `${node}:${toolsWithoutNode()}`;
  return { root, served: serve(root, { PATH: path, ...env }) };
};

describe("the session process refuses an unusable Node with a reason", () => {
  test("Node 22 first on PATH: the handshake, no tools, the reason, and a clean end", async () => {
    const { served } = refusedSession("22.11.0");
    served.send(INITIALIZE);
    const initialized = (await served.next()) as {
      id: number;
      result: {
        protocolVersion: string;
        capabilities: Record<string, unknown>;
        serverInfo: { name: string; version: string };
        instructions: string;
      };
    };
    expect(initialized.id).toBe(1);
    expect(initialized.result.protocolVersion).toBe("2025-03-26");
    expect(initialized.result.capabilities).toEqual({ tools: {} });
    expect(initialized.result.serverInfo).toEqual({ name: "askboard", version: "9.8.7" });
    expect(initialized.result.instructions).toContain("24.22.1");
    expect(initialized.result.instructions).toContain("22.11.0");
    expect(initialized.result.instructions).toContain("ask the user another way");
    served.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    served.send(request(2, "tools/list"));
    expect(await served.next()).toEqual({ jsonrpc: "2.0", id: 2, result: { tools: [] } });
    // Still running: Claude Code would cache an early exit as a failed server.
    await Bun.sleep(100);
    expect(served.running()).toBe(true);
    expect(await served.end()).toBe(0);
    const lines = (await served.stderr()).split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("24.22.1");
    expect(lines[0]).toContain("22.11.0");
  });

  test("no node on PATH: the instructions say Node 24.22.1 or later was not found", async () => {
    const { served } = refusedSession("none");
    served.send(INITIALIZE);
    const answer = (await served.next()) as { result: { instructions: string } };
    expect(answer.result.instructions).toContain("24.22.1");
    expect(answer.result.instructions).toContain("not found on PATH");
    expect(await served.end()).toBe(0);
    expect((await served.stderr()).split("\n").filter(Boolean)).toHaveLength(1);
  });

  test("ping answers {}, an unknown method -32601, a notification and a non-JSON line nothing", async () => {
    const { served } = refusedSession("22.11.0");
    served.send(request(3, "ping"));
    served.send(request(4, "resources/list"));
    served.send({ jsonrpc: "2.0", method: "notifications/cancelled", params: { requestId: 1 } });
    served.send("this is not json");
    served.send("{ broken");
    served.send("");
    served.send(request(5, "ping"));
    expect(await served.next()).toEqual({ jsonrpc: "2.0", id: 3, result: {} });
    const unknown = (await served.next()) as { id: number; error: { code: number } };
    expect(unknown.id).toBe(4);
    expect(unknown.error.code).toBe(-32601);
    // The next answer is the ping after the ignored lines.
    expect(await served.next()).toEqual({ jsonrpc: "2.0", id: 5, result: {} });
    expect(await served.end()).toBe(0);
  });

  test.each([
    ["a number", 7, "7"],
    ["zero", 0, "0"],
    ["a string", "req-1", '"req-1"'],
    ["a string with quotes and a backslash", 'q"x\\y', null],
  ])("a request ID that is %s is echoed as it came", async (_name, id) => {
    const { served } = refusedSession("22.11.0");
    served.send(request(id, "ping"));
    const answer = (await served.next()) as { id: unknown };
    expect(answer.id).toBe(id);
    expect(typeof answer.id).toBe(typeof id);
    await served.end();
  });

  test("the top-level id and method are read, not those inside params, in any key order", async () => {
    const { served } = refusedSession("22.11.0");
    served.send(
      '{"params":{"id":99,"method":"initialize","protocolVersion":"2024-11-05"},"method":"ping","id":5,"jsonrpc":"2.0"}',
    );
    expect(await served.next()).toEqual({ jsonrpc: "2.0", id: 5, result: {} });
    served.send(
      ' {"jsonrpc":"2.0","id":6,"method":"initialize","params":{"nested":{"a":["]","}"]},"protocolVersion":"2024-11-05"}} ',
    );
    const initialized = (await served.next()) as {
      id: number;
      result: { protocolVersion: string };
    };
    expect(initialized.id).toBe(6);
    expect(initialized.result.protocolVersion).toBe("2024-11-05");
    await served.end();
  });

  test("an initialize without a protocol version still answers", async () => {
    const { served } = refusedSession("22.11.0");
    served.send(request(1, "initialize"));
    const answer = (await served.next()) as { result: { protocolVersion: string } };
    expect(typeof answer.result.protocolVersion).toBe("string");
    expect(answer.result.protocolVersion).not.toBe("");
    await served.end();
  });

  test("a found version with a quote and a backslash is escaped and the line stays one line", async () => {
    const found = '2"2\\.0{\\"x\\"}';
    const { served } = refusedSession(found);
    served.send(INITIALIZE);
    const answer = (await served.next()) as { result: { instructions: string } };
    expect(answer.result.instructions).toContain(found);
    await served.end();
    const stderr = await served.stderr();
    expect(stderr.split("\n").filter(Boolean)).toHaveLength(1);
    expect(stderr).toContain(found);
  });

  test("a found version with control characters cannot add lines or break the JSON", async () => {
    const { served } = refusedSession("22.1\n1\t\u0007\u001b[31m");
    served.send(INITIALIZE);
    const answer = (await served.next()) as { result: { instructions: string } };
    expect(answer.result.instructions).toContain("22.1");
    await served.end();
  });

  test("the server version is the plugin manifest's, on the real script too", async () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8"));
    const served = serve(ROOT, {
      PATH: `${shimNode(folder())}:${toolsWithoutNode()}`,
      SHIM_VERSION: "20.0.0",
      SHIM_LOG: join(folder(), "log"),
    });
    served.send(request(1, "initialize"));
    const answer = (await served.next()) as { result: { serverInfo: { version: string } } };
    expect(answer.result.serverInfo.version).toBe(manifest.version);
    await served.end();
  });

  test("a last line with no newline is answered when stdin closes", async () => {
    const { root } = refusedSession("22.11.0");
    const { node } = refusal("22.11.0");
    const child = Bun.spawn(["/bin/sh", join(root, "scripts", "askboard")], {
      env: { PATH: `${node}:${toolsWithoutNode()}`, SHIM_VERSION: "22.11.0" },
      stdin: new Blob([JSON.stringify(request(9, "ping"))]),
      stdout: "pipe",
      stderr: "ignore",
    });
    expect(JSON.parse(await new Response(child.stdout).text())).toEqual({
      jsonrpc: "2.0",
      id: 9,
      result: {},
    });
    expect(await child.exited).toBe(0);
  });
});

describe("hooks and the client refuse an unusable Node quietly", () => {
  const modes = async (found: string, args: string[]): Promise<Ran> => {
    const root = pluginRoot();
    const { node, env } = refusal(found);
    const path = found === "none" ? node : `${node}:${toolsWithoutNode()}`;
    const child = Bun.spawn(["/bin/sh", join(root, "scripts", "askboard"), ...args], {
      env: { PATH: path, ...env },
      stdin: new Blob(["{}"]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { code, stdout, stderr, recorded: [] };
  };

  test.each(["22.11.0", "none", "24.22.0"])(
    "hook PreToolUse with node %s exits 0, silent on stdout",
    async (found) => {
      const ran = await modes(found, ["hook", "PreToolUse"]);
      expect(ran.code).toBe(0);
      expect(ran.stdout).toBe("");
      const lines = ran.stderr.split("\n").filter(Boolean);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("24.22.1");
    },
  );

  test.each(["22.11.0", "none"])(
    "hook PreToolUse with node %s reads and drops its whole input, more than a pipe holds (U-1)",
    async (found) => {
      const root = pluginRoot();
      const { node, env } = refusal(found);
      const path = found === "none" ? node : `${node}:${toolsWithoutNode()}`;
      const finished = join(folder(), "finished");
      // The writer leaves its marker only if every byte was taken: a reader that exits first makes
      // `head` fail on its write (EPIPE, or SIGPIPE), and the marker is not written.
      const child = Bun.spawn(
        [
          "/bin/sh",
          "-c",
          '{ head -c 300000 /dev/zero && echo done > "$FINISHED"; } | /bin/sh "$SCRIPT" hook PreToolUse',
        ],
        {
          env: {
            PATH: `${path}:${SYSTEM_PATH}`,
            ...env,
            FINISHED: finished,
            SCRIPT: join(root, "scripts", "askboard"),
          },
          stdout: "pipe",
          stderr: "pipe",
        },
      );
      const [stdout, stderr, code] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ]);
      expect(code).toBe(0);
      expect(stdout).toBe("");
      expect(stderr.split("\n").filter(Boolean)).toHaveLength(1);
      expect(existsSync(finished)).toBe(true);
    },
  );

  test.each(["22.11.0", "none"])(
    "client /x with node %s exits 1 with one stderr line",
    async (found) => {
      const ran = await modes(found, ["client", "/x"]);
      expect(ran.code).toBe(1);
      expect(ran.stdout).toBe("");
      const lines = ran.stderr.split("\n").filter(Boolean);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("24.22.1");
    },
  );

  test("any other argument exits 1 with one stderr line", async () => {
    const ran = await modes("22.11.0", ["doctor"]);
    expect(ran.code).toBe(1);
    expect(ran.stderr.split("\n").filter(Boolean)).toHaveLength(1);
  });

  test("the stderr line is one line and names a found version that is hostile", async () => {
    const ran = await modes("22\n\u001b[31mred\u0007", ["hook", "SubagentStop"]);
    expect(ran.stderr.split("\n").filter(Boolean)).toHaveLength(1);
    expect(ran.stderr).not.toContain("\u001b");
    expect(ran.code).toBe(0);
  });
});

/** The machine's real Node binary and whether it is 24.22.1 or later, read from the repository. */
const realNode = ((): { path: string; usable: boolean } => {
  const probe = Bun.spawnSync(["node", "-p", 'process.versions.node + " " + process.execPath'], {
    cwd: ROOT,
    stderr: "pipe",
  })
    .stdout.toString()
    .trim();
  const at = probe.indexOf(" ");
  const [major = 0, minor = 0, patch = 0] = probe.slice(0, at).split(".").map(Number);
  return {
    path: probe.slice(at + 1),
    usable:
      at > 0 && (major > 24 || (major === 24 && (minor > 22 || (minor === 22 && patch >= 1)))),
  };
})();

/**
 * What a version manager's `node` is: a script that runs the real Node as its child and does not
 * replace itself with it (Volta forks the real binary), counting its calls in `$SHIM_CALLS`.
 */
const forkingNode = (into: string): string => {
  mkdirSync(into, { recursive: true });
  const shim = join(into, "node");
  writeFileSync(
    shim,
    ["#!/bin/sh", 'echo "call $*" >> "$SHIM_CALLS"', '"$REAL_NODE" "$@"', ""].join("\n"),
  );
  chmodSync(shim, 0o755);
  return into;
};

describe("the start script runs Node's own binary (task 1.13)", () => {
  test.skipIf(!realNode.usable)(
    "behind a forking shim the bundle's parent is the script's caller, and one node run reads version and path",
    async () => {
      const root = pluginRoot();
      const scratch = folder();
      const parentFile = join(scratch, "ppid");
      writeFileSync(
        join(root, "dist", "askboard.mjs"),
        'import { writeFileSync } from "node:fs";\nwriteFileSync(process.env.PARENT_FILE, String(process.ppid));\n',
      );
      const calls = join(scratch, "calls");
      const ran = await runScript(join(root, "scripts", "askboard"), [], {
        version: "unused",
        shims: forkingNode(folder()),
        env: { REAL_NODE: realNode.path, SHIM_CALLS: calls, PARENT_FILE: parentFile },
      });
      expect(ran.code).toBe(0);
      // Not the shim's PID: the shim stays behind the exec, so the bundle's parent is this test.
      expect(readFileSync(parentFile, "utf8")).toBe(String(process.pid));
      // The one run is the probe; the bundle ran from the path the probe printed, not from the shim.
      expect(readFileSync(calls, "utf8").split("\n").filter(Boolean)).toHaveLength(1);
    },
  );

  test("the probe asks for the version and the path in one run, and the script execs the path", async () => {
    const root = pluginRoot();
    const into = folder();
    const real = join(into, "a folder with spaces", "real-node");
    mkdirSync(join(into, "a folder with spaces"));
    const recorder = join(folder(), "run.log");
    writeFileSync(
      real,
      [
        "#!/bin/sh",
        '{ printf \'ppid=%s\\n\' "$PPID"; for a in "$@"; do printf \'arg=%s\\n\' "$a"; done; } > "$SHIM_LOG"',
        "",
      ].join("\n"),
    );
    chmodSync(real, 0o755);
    const shim = join(folder(), "node");
    writeFileSync(
      shim,
      [
        "#!/bin/sh",
        'if [ "$1" = "-p" ]; then printf \'%s\\n\' "$2" > "$SHIM_PROBE"; printf \'24.22.1 %s\\n\' "$REAL"; exit 0; fi',
        'echo "the shim ran the bundle" > "$SHIM_LOG"',
        "",
      ].join("\n"),
    );
    chmodSync(shim, 0o755);
    const probe = join(folder(), "probe");
    const ran = await runScript(join(root, "scripts", "askboard"), ["hook", "PreToolUse"], {
      version: "unused",
      shims: join(shim, ".."),
      env: { REAL: real, SHIM_PROBE: probe, SHIM_LOG: recorder },
    });
    expect(ran.code).toBe(0);
    const program = readFileSync(probe, "utf8");
    expect(program).toContain("process.versions.node");
    expect(program).toContain("process.execPath");
    expect(readFileSync(recorder, "utf8").split("\n").filter(Boolean)).toEqual([
      `ppid=${process.pid}`,
      `arg=${join(root, "dist", "askboard.mjs")}`,
      "arg=hook",
      "arg=PreToolUse",
    ]);
  });

  test.each([
    ["no path", "24.22.1"],
    ["a relative path", "24.22.1 bin/node"],
    ["a path that is not there", "24.22.1 /nonexistent/askboard-test/node"],
  ])("a probe with %s falls back to `node` on PATH", async (_name, output) => {
    const root = pluginRoot();
    const into = folder();
    const shim = join(into, "node");
    writeFileSync(
      shim,
      [
        "#!/bin/sh",
        'if [ "$1" = "-p" ]; then printf \'%s\\n\' "$SHIM_OUTPUT"; exit 0; fi',
        '{ printf \'ppid=%s\\n\' "$PPID"; for a in "$@"; do printf \'arg=%s\\n\' "$a"; done; } > "$SHIM_LOG"',
        "",
      ].join("\n"),
    );
    chmodSync(shim, 0o755);
    const ran = await runScript(join(root, "scripts", "askboard"), ["x"], {
      version: "unused",
      shims: into,
      env: { SHIM_OUTPUT: output },
    });
    expect(argsOf(ran.recorded)).toEqual([join(root, "dist", "askboard.mjs"), "x"]);
    expect(ran.recorded).toContain(`ppid=${process.pid}`);
  });

  test("a refusal names the version found and not the path", async () => {
    const root = pluginRoot();
    const ran = await runScript(join(root, "scripts", "askboard"), ["hook", "PreToolUse"], {
      version: "22.11.0",
    });
    const [line] = ran.stderr.split("\n").filter(Boolean);
    expect(line).toContain("found 22.11.0");
    expect(line).not.toContain("/node");
  });
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
        { result?: { serverInfo?: { name: string; version: string }; tools?: { name: string }[] } }
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
      const manifest = JSON.parse(
        readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8"),
      );
      expect(answers[1]?.result?.serverInfo?.version).toBe(manifest.version);
      expect(answers[2]?.result?.tools?.map((tool) => tool.name)).toContain("ask");
      expect(exited).toBe(0);
    },
    40_000,
  );

  test.skipIf(missing !== null || !usable)(
    "with CLAUDE_PROJECT_DIR unset the session file names no project directory (AD-12)",
    async () => {
      const project = realpathSync(folder("askboard-start-project-"));
      // Short, since the local API's socket path has a platform limit that tmpdir() can exceed.
      const temp = realpathSync(mkdtempSync("/tmp/ab-"));
      folders.push(temp);
      const env: Record<string, string | undefined> = {
        ...process.env,
        XDG_RUNTIME_DIR: undefined,
        CLAUDE_PROJECT_DIR: undefined,
        TMPDIR: temp,
      };
      const child = Bun.spawn(["/bin/sh", SCRIPT], {
        cwd: project,
        env,
        stdin: "pipe",
        stdout: "ignore",
        stderr: "pipe",
      });
      const init = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "t", version: "0" },
        },
      };
      // The local API, and with it the session file, starts at the first request after discovery.
      const lines = [init, { jsonrpc: "2.0", id: 2, method: "tools/list" }];
      child.stdin.write(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
      child.stdin.flush();
      // The one session file of the temporary session folder, whatever PID names it.
      const folderOf = join(temp, `askboard-${process.getuid?.()}`);
      const sessionFiles = (): string[] =>
        existsSync(folderOf) ? readdirSync(folderOf).filter((name) => name.endsWith(".json")) : [];
      const deadline = Date.now() + 20_000;
      while (sessionFiles().length === 0 && Date.now() < deadline) await Bun.sleep(100);
      const [name] = sessionFiles();
      const session =
        name === undefined ? undefined : JSON.parse(readFileSync(join(folderOf, name), "utf8"));
      child.stdin.end();
      const exited = await Promise.race([child.exited, Bun.sleep(10_000).then(() => "timeout")]);
      if (exited === "timeout") child.kill();
      expect(session).toBeDefined();
      expect(session).not.toHaveProperty("projectDir");
    },
    40_000,
  );

  test.skipIf(missing !== null || !realNode.usable)(
    "behind a forking shim the session file is named by the caller's PID (AD-5)",
    async () => {
      const temp = realpathSync(mkdtempSync("/tmp/ab-"));
      folders.push(temp);
      const child = Bun.spawn(["/bin/sh", SCRIPT], {
        cwd: ROOT,
        env: {
          PATH: `${forkingNode(folder())}:${SYSTEM_PATH}`,
          REAL_NODE: realNode.path,
          SHIM_CALLS: join(temp, "calls"),
          TMPDIR: temp,
        },
        stdin: "pipe",
        stdout: "ignore",
        stderr: "pipe",
      });
      const init = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "t", version: "0" },
        },
      };
      const lines = [init, { jsonrpc: "2.0", id: 2, method: "tools/list" }];
      child.stdin.write(`${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
      child.stdin.flush();
      const folderOf = join(temp, `askboard-${process.getuid?.()}`);
      const file = sessionFilePath(folderOf, process.pid);
      const deadline = Date.now() + 20_000;
      while (!existsSync(file) && Date.now() < deadline) await Bun.sleep(100);
      const named = existsSync(folderOf) ? readdirSync(folderOf) : [];
      child.stdin.end();
      const exited = await Promise.race([child.exited, Bun.sleep(10_000).then(() => "timeout")]);
      if (exited === "timeout") child.kill();
      expect(named).toContain(`${process.pid}.json`);
    },
    40_000,
  );
});
