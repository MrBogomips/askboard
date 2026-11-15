import { describe, expect, test } from "bun:test";
import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
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

  test("the Codex files are gitignored; OpenSpec's shared skills are not", () => {
    const ignored = (path: string): boolean =>
      Bun.spawnSync(["git", "check-ignore", "-q", "--no-index", path], { cwd: ROOT }).exitCode ===
      0;
    for (const generated of [
      "AGENTS.md",
      ".codex/agents/askboard-architect.toml",
      ".codex/codex-port.manifest",
      ".agents/skills/askboard-delivery/SKILL.md",
      ".agents/skills/askboard-delivery/agents/openai.yaml",
      ".agents/other.txt",
    ]) {
      expect({ generated, ignored: ignored(generated) }).toEqual({ generated, ignored: true });
    }
    for (const openspec of [
      ".agents/skills/.openspec-target",
      ".agents/skills/openspec-propose/SKILL.md",
    ]) {
      expect({ openspec, ignored: ignored(openspec) }).toEqual({ openspec, ignored: false });
    }
  });

  test("every skill linked into .claude/skills resolves to OpenSpec's tracked shared copy", () => {
    const links = readdirSync(join(ROOT, ".claude/skills")).filter((name) =>
      lstatSync(join(ROOT, ".claude/skills", name)).isSymbolicLink(),
    );
    expect(links.length).toBeGreaterThan(0);
    for (const name of links) {
      expect(name).toStartWith("openspec-");
      expect(readlinkSync(join(ROOT, ".claude/skills", name))).toBe(`../../.agents/skills/${name}`);
      const tracked = Bun.spawnSync(
        ["git", "ls-files", "--error-unmatch", `.agents/skills/${name}/SKILL.md`],
        { cwd: ROOT },
      );
      expect({ name, tracked: tracked.exitCode }).toEqual({ name, tracked: 0 });
    }
  });

  test("setup.sh carries the codex-port block and runs it", () => {
    const setup = read("setup.sh");
    expect(setup).toMatch(BLOCK);
    expect(setup.replace(BLOCK, "")).toMatch(/^\s*codex_port\b/m);
  });

  test("CI converts the sources in the codex job only; the shared setup skips the Codex files", () => {
    expect(read(".github/actions/setup-bun/action.yml")).toContain("setup.sh --ci --no-codex");
    expect(read(".github/workflows/codex.yml")).toContain("setup.sh --codex-only");
    for (const workflow of ["check", "browser", "conformance", "e2e", "openspec", "release"]) {
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
