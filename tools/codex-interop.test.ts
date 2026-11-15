import { describe, expect, test } from "bun:test";
import { lstatSync, readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";

// Codex interop (AGENTS.md): AGENTS.md is the one instruction file, written by hand and committed;
// CLAUDE.md is a symlink to it and Claude Code's own lines are in .claude/CLAUDE.md. The Codex
// files are generated from .claude/ by the codex-port block of setup.sh with the latest rulesync,
// gitignored, except OpenSpec's shared skills, which it commits.
const ROOT = join(import.meta.dir, "..");
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const BLOCK = /# >>> codex-port >>>\n([\s\S]*?)# <<< codex-port <<</;
const ignored = (path: string): boolean =>
  Bun.spawnSync(["git", "check-ignore", "-q", "--no-index", path], { cwd: ROOT }).exitCode === 0;

describe("Codex interop", () => {
  test("AGENTS.md imports nothing: Codex resolves no @ import", () => {
    const imports = read("AGENTS.md")
      .split("\n")
      .filter((line) => /^@\S/.test(line));
    expect(imports).toEqual([]);
  });

  test("AGENTS.md is a real file and CLAUDE.md a symbolic link to it", () => {
    expect(lstatSync(join(ROOT, "AGENTS.md")).isFile()).toBe(true);
    expect(lstatSync(join(ROOT, "CLAUDE.md")).isSymbolicLink()).toBe(true);
    expect(readlinkSync(join(ROOT, "CLAUDE.md"))).toBe("AGENTS.md");
  });

  test("every other CLAUDE.md outside .claude/ links to the AGENTS.md beside it", () => {
    const listed = Bun.spawnSync(
      ["git", "ls-files", "--cached", "--others", "--exclude-standard", "*CLAUDE.md"],
      { cwd: ROOT },
    );
    const nested = listed.stdout
      .toString()
      .split("\n")
      .filter((path) => path.endsWith("/CLAUDE.md") && !path.startsWith(".claude/"));
    for (const path of nested) {
      const link = lstatSync(join(ROOT, path)).isSymbolicLink()
        ? readlinkSync(join(ROOT, path))
        : "";
      expect({ path, link }).toEqual({ path, link: "AGENTS.md" });
    }
  });

  test("the instruction files are committed, never ignored", () => {
    for (const source of [
      "AGENTS.md",
      "CLAUDE.md",
      ".claude/CLAUDE.md",
      "docs/AGENTS.md",
      "docs/CLAUDE.md",
      ".github/AGENTS.md",
      ".github/CLAUDE.md",
      "tools/AGENTS.md",
      "tools/CLAUDE.md",
    ]) {
      expect({ source, ignored: ignored(source) }).toEqual({ source, ignored: false });
    }
  });

  test("the Codex files are gitignored; OpenSpec's shared skills are not", () => {
    for (const generated of [
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

  test("the block keeps the local amendment for OpenSpec's linked skills", () => {
    // Not in the port-to-codex template: a block vendored again must carry it over.
    const block = BLOCK.exec(read("setup.sh"))?.[1] ?? "";
    expect(block).toContain("Local amendment");
    expect(block).toContain("cp_linked() {");
    expect(block.match(/cp_linked "/g)?.length).toBe(3);
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
