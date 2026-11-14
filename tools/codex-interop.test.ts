import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Codex interop (CLAUDE.md): CLAUDE.md is the one source, and the Codex files are generated
// by the codex-port block of setup.sh with the latest rulesync, gitignored.
const ROOT = join(import.meta.dir, "..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const BLOCK = /# >>> codex-port >>>\n([\s\S]*?)# <<< codex-port <<</;

describe("Codex interop", () => {
  test("CLAUDE.md imports nothing, so its Codex form needs no import", () => {
    const imports = read("CLAUDE.md")
      .split("\n")
      .filter((line) => /^@\S/.test(line));
    expect(imports).toEqual([]);
  });

  test("the Codex files are gitignored", () => {
    const ignored = read(".gitignore").split("\n");
    expect(ignored).toEqual(expect.arrayContaining(["/AGENTS.md", "/.agents/", "/.codex/"]));
  });

  test("setup.sh carries the codex-port block and runs it", () => {
    const setup = read("setup.sh");
    expect(setup).toMatch(BLOCK);
    expect(setup.replace(BLOCK, "")).toMatch(/^\s*codex_port\b/m);
  });

  test("CI converts the sources in the codex job only; the shared setup skips the Codex files", () => {
    expect(read(".github/actions/setup-bun/action.yml")).toContain("setup.sh --ci --no-codex");
    expect(read(".github/workflows/codex.yml")).toContain("setup.sh --codex-only");
    for (const workflow of ["check", "browser", "conformance", "openspec", "release"]) {
      expect(read(`.github/workflows/${workflow}.yml`)).not.toContain("--codex-only");
    }
  });

  test("the block always runs the latest rulesync, never a pinned one", () => {
    const block = BLOCK.exec(read("setup.sh"))?.[1] ?? "";
    const fetches = block.match(/rulesync@[^\s"']+/g) ?? [];
    expect(fetches.length).toBeGreaterThan(0);
    expect(fetches.filter((spec) => !/^rulesync@(latest|\$cp_version)$/.test(spec))).toEqual([]);
    expect(block).toContain("rulesync@latest --version");
  });
});
