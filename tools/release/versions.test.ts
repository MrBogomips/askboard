import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { processPorts, runCli, setVersion } from "./version.ts";
import { versionProblems } from "./versions.ts";

const repositoryRoot = join(import.meta.dir, "..", "..");
const temporary: string[] = [];

/** A miniature checkout: the root manifest, the plugin manifest and two package manifests. */
const checkout = (versions: { root?: string; plugin?: string; a?: string; b?: string }): string => {
  const root = mkdtempSync(join(tmpdir(), "askboard-versions-"));
  temporary.push(root);
  const write = (path: string, body: Record<string, unknown>) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), `${JSON.stringify(body, null, 2)}\n`);
  };
  write("package.json", {
    name: "askboard",
    ...(versions.root === undefined ? {} : { version: versions.root }),
    private: true,
  });
  write(".claude-plugin/plugin.json", { name: "askboard", version: versions.plugin ?? "0.1.0" });
  write("packages/a/package.json", { name: "@askboard/a", version: versions.a ?? "0.1.0" });
  write("packages/b/package.json", { name: "@askboard/b", version: versions.b ?? "0.1.0" });
  return root;
};

const versionIn = (root: string, path: string): unknown =>
  JSON.parse(readFileSync(join(root, path), "utf8")).version;

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("versionProblems", () => {
  test("equal versions pass", () => {
    expect(versionProblems(checkout({ root: "0.1.0" }))).toEqual([]);
  });

  test("a package that differs fails naming its file and both versions", () => {
    const problems = versionProblems(checkout({ root: "0.1.0", b: "0.0.0" }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("packages/b/package.json");
    expect(problems[0]).toContain("0.0.0");
    expect(problems[0]).toContain("0.1.0");
  });

  test("the plugin manifest that differs fails naming its file and both versions", () => {
    const problems = versionProblems(checkout({ root: "0.2.0", plugin: "0.1.0" }));
    expect(problems.join("\n")).toContain(".claude-plugin/plugin.json");
    expect(problems.join("\n")).toContain("0.2.0");
    expect(problems.join("\n")).toContain("0.1.0");
  });

  test("every differing file is named, not only the first", () => {
    const problems = versionProblems(checkout({ root: "0.1.0", a: "0.0.1", b: "0.0.2" }));
    expect(problems).toHaveLength(2);
  });

  test("a missing root version fails", () => {
    const problems = versionProblems(checkout({}));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("package.json");
    expect(problems[0]).toContain("no version");
  });

  test("a version that is not major.minor.patch fails", () => {
    const problems = versionProblems(checkout({ root: "0.1", a: "0.1" }));
    expect(problems.join("\n")).toContain("0.1");
    expect(problems.length).toBeGreaterThan(0);
  });

  test("a manifest without a version fails naming its file", () => {
    const root = checkout({ root: "0.1.0" });
    writeFileSync(join(root, "packages/a/package.json"), `{"name":"@askboard/a"}\n`);
    const problems = versionProblems(root);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("packages/a/package.json");
    expect(problems[0]).toContain("no version");
  });

  test("the repository's versions agree", () => {
    expect(versionProblems(repositoryRoot)).toEqual([]);
  });
});

describe("setVersion", () => {
  test("writes every manifest, adding the root's version when it has none", () => {
    const root = checkout({ plugin: "0.0.0", a: "0.0.0", b: "0.0.0" });
    setVersion(root, "1.2.3");
    for (const path of [
      "package.json",
      ".claude-plugin/plugin.json",
      "packages/a/package.json",
      "packages/b/package.json",
    ]) {
      expect(versionIn(root, path)).toBe("1.2.3");
    }
    expect(versionProblems(root)).toEqual([]);
  });

  test("keeps the rest of each file as it was", () => {
    const root = checkout({ root: "0.0.0", a: "0.0.0" });
    const before = readFileSync(join(root, "packages/a/package.json"), "utf8");
    setVersion(root, "0.4.0");
    expect(readFileSync(join(root, "packages/a/package.json"), "utf8")).toBe(
      before.replace('"version": "0.0.0"', '"version": "0.4.0"'),
    );
  });

  test("keeps a nested version field alone", () => {
    const root = checkout({ root: "0.0.0" });
    writeFileSync(
      join(root, "packages/a/package.json"),
      `{\n  "name": "@askboard/a",\n  "version": "0.0.0",\n  "volta": {\n    "version": "9.9.9"\n  }\n}\n`,
    );
    setVersion(root, "0.3.0");
    const parsed = JSON.parse(readFileSync(join(root, "packages/a/package.json"), "utf8"));
    expect(parsed.version).toBe("0.3.0");
    expect(parsed.volta.version).toBe("9.9.9");
  });

  test.each(["1.2", "v1.2.3", "1.2.3-beta", "1.2.3.4", "", "01.2.3"])("refuses %p", (version) => {
    const root = checkout({ root: "0.1.0" });
    expect(() => setVersion(root, version)).toThrow(/major\.minor\.patch/);
    expect(versionIn(root, "package.json")).toBe("0.1.0");
  });

  test("refuses before writing anything when a manifest cannot take the version", () => {
    const root = checkout({ root: "0.1.0" });
    writeFileSync(join(root, "packages/b/package.json"), "{ not json");
    expect(() => setVersion(root, "0.2.0")).toThrow(/packages\/b\/package\.json/);
    expect(versionIn(root, "package.json")).toBe("0.1.0");
    expect(versionIn(root, "packages/a/package.json")).toBe("0.1.0");
  });

  test("works on a copy of the real manifests", () => {
    const root = mkdtempSync(join(tmpdir(), "askboard-versions-real-"));
    temporary.push(root);
    cpSync(join(repositoryRoot, "package.json"), join(root, "package.json"));
    cpSync(join(repositoryRoot, ".claude-plugin"), join(root, ".claude-plugin"), {
      recursive: true,
    });
    cpSync(
      join(repositoryRoot, "packages/core/package.json"),
      join(root, "packages/core/package.json"),
    );
    setVersion(root, "7.8.9");
    expect(versionProblems(root)).toEqual([]);
    expect(versionIn(root, "package.json")).toBe("7.8.9");
    expect(readFileSync(join(root, "package.json"), "utf8")).toContain('"private": true');
  });
});

describe("runCli", () => {
  const ports = (lock: boolean) => {
    const lines = { out: [] as string[], err: [] as string[], locks: 0 };
    return {
      lines,
      ports: {
        refreshLock: () => {
          lines.locks += 1;
          return lock;
        },
        stdout: (line: string) => lines.out.push(line),
        stderr: (line: string) => lines.err.push(line),
      },
    };
  };

  test("sets the version, refreshes the lock and says how many manifests", () => {
    const root = checkout({ root: "0.1.0" });
    const { lines, ports: p } = ports(true);
    expect(runCli(root, ["0.2.0"], p)).toBe(0);
    expect(lines.locks).toBe(1);
    expect(lines.out[0]).toContain("0.2.0");
    expect(versionProblems(root)).toEqual([]);
    expect(versionIn(root, "package.json")).toBe("0.2.0");
  });

  test("a bad version exits 1, writes nothing and leaves the lock alone", () => {
    const root = checkout({ root: "0.1.0" });
    const { lines, ports: p } = ports(true);
    expect(runCli(root, ["1.2"], p)).toBe(1);
    expect(runCli(root, [], p)).toBe(1);
    expect(lines.locks).toBe(0);
    expect(lines.err[0]).toContain("major.minor.patch");
    expect(versionIn(root, "package.json")).toBe("0.1.0");
  });

  test("a lock that cannot be refreshed exits 1 and says so", () => {
    const { lines, ports: p } = ports(false);
    expect(runCli(checkout({ root: "0.1.0" }), ["0.2.0"], p)).toBe(1);
    expect(lines.err[0]).toContain("bun.lock");
  });
});

describe("processPorts", () => {
  test("writes a line to stdout and to stderr", () => {
    const out = spyOn(process.stdout, "write").mockReturnValue(true);
    const err = spyOn(process.stderr, "write").mockReturnValue(true);
    try {
      processPorts.stdout("fine");
      processPorts.stderr("bad");
      expect(out).toHaveBeenCalledWith("fine\n");
      expect(err).toHaveBeenCalledWith("bad\n");
    } finally {
      out.mockRestore();
      err.mockRestore();
    }
  });

  test("refreshes the lock of a project that installs offline and reports one that cannot", () => {
    const good = mkdtempSync(join(tmpdir(), "askboard-lock-"));
    const bad = mkdtempSync(join(tmpdir(), "askboard-lock-"));
    temporary.push(good, bad);
    writeFileSync(join(good, "package.json"), '{"name":"lock-probe","version":"1.0.0"}\n');
    writeFileSync(join(bad, "package.json"), "{ not json");
    expect(processPorts.refreshLock(good)).toBe(true);
    expect(processPorts.refreshLock(bad)).toBe(false);
  });

  test("the command line exits 1 on a bad version", () => {
    const run = Bun.spawnSync(["bun", join(import.meta.dir, "version.ts"), "1.2"], {
      stderr: "pipe",
    });
    expect(run.exitCode).toBe(1);
    expect(run.stderr.toString()).toContain("major.minor.patch");
  });
});
