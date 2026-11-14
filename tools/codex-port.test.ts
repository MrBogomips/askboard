import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// The codex-port block of setup.sh (CLAUDE.md, Codex interop), run in a scratch repository with a
// stub npx in place of rulesync, so the test needs no network.
const SETUP = join(import.meta.dir, "..", "setup.sh");

// The stub mirrors rulesync's layout: CLAUDE.md -> AGENTS.md, skills -> .agents/skills,
// agents -> .codex/agents/*.toml. STUB_MODE changes what it does.
const STUB_NPX = `#!/bin/sh
case "$*" in
  *--version*)
    [ "\${STUB_MODE:-}" = offline ] && { echo "npm error network" >&2; exit 1; }
    echo 9.9.9; exit 0 ;;
esac
[ "\${STUB_MODE:-}" = empty ] && exit 0
[ -f CLAUDE.md ] && cp CLAUDE.md AGENTS.md
for s in .claude/skills/*/; do
  [ -d "$s" ] || continue
  n=$(basename "$s"); mkdir -p ".agents/skills/$n"; cp -R "$s". ".agents/skills/$n/"
done
for a in .claude/agents/*.md; do
  [ -f "$a" ] || continue
  mkdir -p .codex/agents; n=$(basename "$a" .md)
  printf 'name = "%s"\\n' "$n" > ".codex/agents/$n.toml"
done
`;

let repo: string;
let bin: string;

function write(path: string, text: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}

function read(path: string): string {
  return readFileSync(join(repo, path), "utf8");
}

function run(args: string[], mode = ""): { code: number; out: string } {
  const result = Bun.spawnSync(["sh", join(repo, "setup.sh"), ...args], {
    cwd: repo,
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STUB_MODE: mode, CI: "" },
  });
  return { code: result.exitCode, out: `${result.stdout}${result.stderr}` };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "codex-port-repo-"));
  bin = mkdtempSync(join(tmpdir(), "codex-port-bin-"));
  writeFileSync(join(bin, "npx"), STUB_NPX);
  chmodSync(join(bin, "npx"), 0o755);
  Bun.spawnSync(["git", "init", "-q"], { cwd: repo });
  writeFileSync(join(repo, "setup.sh"), readFileSync(SETUP, "utf8"));
  write("CLAUDE.md", "# Project\n\nThe rules.\n");
  write(
    ".claude/skills/alpha/SKILL.md",
    "---\nname: alpha\ndescription: Use when alpha.\n---\nAlpha.\n",
  );
  write(
    ".claude/skills/beta/SKILL.md",
    "---\nname: beta\ndescription: Use when beta.\n---\nBeta.\n",
  );
  write(".claude/agents/rev.md", "---\nname: rev\ndescription: Reviews.\nmodel: x\n---\nReview.\n");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

describe("codex-port block", () => {
  test("writes the Codex files, marks AGENTS.md with the version and lists the output", () => {
    const { code, out } = run(["--codex-only"]);
    expect(out).toContain("rulesync 9.9.9 wrote AGENTS.md, 2 skills and 1 agents");
    expect(code).toBe(0);
    expect(read("AGENTS.md")).toStartWith(
      "<!-- Generated from CLAUDE.md by codex-port with rulesync 9.9.9;",
    );
    expect(read("AGENTS.md")).toEndWith("# Project\n\nThe rules.\n");
    expect(read(".codex/codex-port.manifest").split("\n")).toEqual(
      expect.arrayContaining([
        "AGENTS.md",
        ".agents/skills/alpha/SKILL.md",
        ".codex/agents/rev.toml",
      ]),
    );
  });

  test("removes the output of a source that is gone", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    rmSync(join(repo, ".claude/skills/beta"), { recursive: true });
    expect(run(["--codex-only"]).code).toBe(0);
    expect(existsSync(join(repo, ".agents/skills/beta"))).toBe(false);
    expect(existsSync(join(repo, ".agents/skills/alpha/SKILL.md"))).toBe(true);
  });

  test("refuses to overwrite a hand-written AGENTS.md, unless forced", () => {
    write("AGENTS.md", "# Hand-written rules\n");
    const refused = run(["--codex-only"]);
    expect(refused.code).not.toBe(0);
    expect(refused.out).toContain("AGENTS.md was not written by codex-port");
    expect(read("AGENTS.md")).toBe("# Hand-written rules\n");
    expect(run(["--force"]).code).toBe(0);
    expect(read("AGENTS.md")).toContain("The rules.");
  });

  test("leaves a personal file it would not write alone", () => {
    write(".codex/config.toml", "model = 'mine'\n");
    expect(run(["--codex-only"]).code).toBe(0);
    expect(read(".codex/config.toml")).toBe("model = 'mine'\n");
  });

  test("carries disable-model-invocation over as a Codex invocation policy", () => {
    write(
      ".claude/skills/alpha/SKILL.md",
      "---\nname: alpha\ndescription: Use when alpha.\ndisable-model-invocation: true\n---\nAlpha.\n",
    );
    expect(run(["--codex-only"]).code).toBe(0);
    expect(read(".agents/skills/alpha/agents/openai.yaml")).toBe(
      "policy:\n  allow_implicit_invocation: false\n",
    );
    expect(existsSync(join(repo, ".agents/skills/beta/agents/openai.yaml"))).toBe(false);
  });

  test("keeps the previous output when rulesync produces the wrong files", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    const before = read("AGENTS.md");
    const broken = run(["--codex-only"], "empty");
    expect(broken.code).not.toBe(0);
    expect(broken.out).toContain("the Codex files are unchanged");
    expect(read("AGENTS.md")).toBe(before);
    expect(existsSync(join(repo, ".codex/agents/rev.toml"))).toBe(true);
  });

  test("says so when rulesync cannot be fetched", () => {
    const offline = run(["--codex-only"], "offline");
    expect(offline.code).not.toBe(0);
    expect(offline.out).toContain("cannot run rulesync");
  });

  test("--check fails on a stale AGENTS.md and passes after a run", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    expect(run(["--check"]).code).toBe(0);
    write("CLAUDE.md", "# Project\n\nNew rules.\n");
    const stale = run(["--check"]);
    expect(stale.code).not.toBe(0);
    expect(stale.out).toContain("AGENTS.md is older than CLAUDE.md");
  });

  test("--dry-run lists the files and writes nothing", () => {
    const dry = run(["--dry-run"]);
    expect(dry.code).toBe(0);
    expect(dry.out).toContain(".codex/agents/rev.toml");
    expect(existsSync(join(repo, "AGENTS.md"))).toBe(false);
  });

  test("never deletes outside the Codex files, whatever the manifest says", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    write("keep.txt", "keep\n");
    write(
      ".codex/codex-port.manifest",
      `${read(".codex/codex-port.manifest")}.codex/../keep.txt\n`,
    );
    expect(run(["--codex-only"]).code).toBe(0);
    expect(existsSync(join(repo, "keep.txt"))).toBe(true);
  });
});
