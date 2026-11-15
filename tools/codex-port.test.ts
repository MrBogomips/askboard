import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// The codex-port block of setup.sh (AGENTS.md, Codex interop), run in a scratch repository with a
// stub npx in place of rulesync, so the test needs no network. AGENTS.md is the hand-written
// instruction file and CLAUDE.md a symlink to it: the block checks them and never writes them.
const SETUP = join(import.meta.dir, "..", "setup.sh");
const RULES = "# Project\n\nThe rules.\n";

// The stub mirrors rulesync's layout: skills -> .agents/skills, agents -> .codex/agents/*.toml.
// It runs in the block's copy of the sources and fails when that copy holds an instruction file
// or a skill linked into .agents/skills, or when it is asked for the `rules` feature, which would
// overwrite AGENTS.md. STUB_MODE changes what it does: `offline` cannot fetch rulesync, `empty`
// writes nothing, `agents` also writes an AGENTS.md, as the `rules` feature would.
const STUB_NPX = `#!/bin/sh
case "$*" in
  *--version*)
    [ "\${STUB_MODE:-}" = offline ] && { echo "npm error network" >&2; exit 1; }
    echo 9.9.9; exit 0 ;;
esac
features=
while [ $# -gt 0 ]; do
  [ "$1" = --features ] && features=$2
  shift
done
case ",$features," in
  *,rules,*) echo "stub rulesync: asked for the rules feature" >&2; exit 1 ;;
esac
for f in AGENTS.md CLAUDE.md .claude/CLAUDE.md; do
  if [ -e "$f" ] || [ -L "$f" ]; then echo "stub rulesync: $f reached the conversion" >&2; exit 1; fi
done
for s in .claude/skills/*; do
  case $(readlink "$s" 2>/dev/null) in
    ../../.agents/skills/*) echo "stub rulesync: linked skill $s reached the conversion" >&2; exit 1 ;;
  esac
done
[ "\${STUB_MODE:-}" = empty ] && exit 0
[ "\${STUB_MODE:-}" = agents ] && echo "# Overwritten by rulesync" > AGENTS.md
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

function remove(path: string): void {
  rmSync(join(repo, path), { recursive: true, force: true });
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
  write("AGENTS.md", RULES);
  symlinkSync("AGENTS.md", join(repo, "CLAUDE.md"));
  write(".claude/CLAUDE.md", "Claude Code only.\n");
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
  test("writes the Codex files, lists them with the version, and leaves AGENTS.md alone", () => {
    const { code, out } = run(["--codex-only"]);
    expect(out).toContain("rulesync 9.9.9 wrote 2 skills and 1 agents");
    expect(code).toBe(0);
    expect(read("AGENTS.md")).toBe(RULES);
    const manifest = read(".codex/codex-port.manifest").split("\n");
    expect(manifest[0]).toBe("# codex-port: rulesync 9.9.9");
    expect(manifest).toEqual(
      expect.arrayContaining([".agents/skills/alpha/SKILL.md", ".codex/agents/rev.toml"]),
    );
    expect(manifest).not.toContain("AGENTS.md");
  });

  test("never takes an AGENTS.md from rulesync's output", () => {
    expect(run(["--codex-only"], "agents").code).toBe(0);
    expect(read("AGENTS.md")).toBe(RULES);
  });

  test("keeps AGENTS.md when an older manifest lists it", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    write(".codex/codex-port.manifest", `AGENTS.md\n${read(".codex/codex-port.manifest")}`);
    expect(run(["--codex-only"]).code).toBe(0);
    expect(read("AGENTS.md")).toBe(RULES);
  });

  test("removes the output of a source that is gone", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    remove(".claude/skills/beta");
    expect(run(["--codex-only"]).code).toBe(0);
    expect(existsSync(join(repo, ".agents/skills/beta"))).toBe(false);
    expect(existsSync(join(repo, ".agents/skills/alpha/SKILL.md"))).toBe(true);
  });

  test("refuses to overwrite a Codex file it did not write, unless forced", () => {
    write(".codex/agents/rev.toml", "name = 'mine'\n");
    const refused = run(["--codex-only"]);
    expect(refused.code).not.toBe(0);
    expect(refused.out).toContain(".codex/agents/rev.toml was not written by codex-port");
    expect(read(".codex/agents/rev.toml")).toBe("name = 'mine'\n");
    expect(run(["--force"]).code).toBe(0);
    expect(read(".codex/agents/rev.toml")).toBe('name = "rev"\n');
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
    const before = read(".codex/codex-port.manifest");
    const broken = run(["--codex-only"], "empty");
    expect(broken.code).not.toBe(0);
    expect(broken.out).toContain("the Codex files are unchanged");
    expect(read(".codex/codex-port.manifest")).toBe(before);
    expect(existsSync(join(repo, ".codex/agents/rev.toml"))).toBe(true);
  });

  test("says so when rulesync cannot be fetched", () => {
    const offline = run(["--codex-only"], "offline");
    expect(offline.code).not.toBe(0);
    expect(offline.out).toContain("cannot run rulesync");
  });

  test("--check passes after a run and fails on a skill not ported yet", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    const fresh = run(["--check"]);
    expect(fresh.out).toContain("up to date (2 skills, 1 agents)");
    expect(fresh.code).toBe(0);
    write(
      ".claude/skills/gamma/SKILL.md",
      "---\nname: gamma\ndescription: Use when gamma.\n---\nGamma.\n",
    );
    const stale = run(["--check"]);
    expect(stale.code).not.toBe(0);
    expect(stale.out).toContain("skill 'gamma' is not ported");
  });

  test("--dry-run lists the files and writes nothing", () => {
    const dry = run(["--dry-run"]);
    expect(dry.code).toBe(0);
    expect(dry.out).toContain(".codex/agents/rev.toml");
    expect(existsSync(join(repo, ".codex"))).toBe(false);
    expect(existsSync(join(repo, ".agents"))).toBe(false);
  });

  test("never deletes outside the Codex files, whatever the manifest says", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    write("keep.txt", "keep\n");
    write(
      ".codex/codex-port.manifest",
      `${read(".codex/codex-port.manifest")}.codex/../keep.txt\nkeep.txt\n`,
    );
    expect(run(["--codex-only"]).code).toBe(0);
    expect(existsSync(join(repo, "keep.txt"))).toBe(true);
  });

  test("warns when AGENTS.md is over Codex's 32 KiB default", () => {
    write("AGENTS.md", `${RULES}${"x".repeat(33_000)}\n`);
    const { code, out } = run(["--codex-only"]);
    expect(code).toBe(0);
    expect(out).toContain("AGENTS.md is over 32 KiB");
  });
});

// The instruction files: AGENTS.md the real file, CLAUDE.md a link to it. Any other shape stops
// the block before it converts anything, and fails --check.
describe("the instruction files", () => {
  const refusals: [string, () => void, string][] = [
    [
      "CLAUDE.md is a regular file",
      () => {
        remove("CLAUDE.md");
        write("CLAUDE.md", RULES);
      },
      "CLAUDE.md is a regular file",
    ],
    ["CLAUDE.md is missing", () => remove("CLAUDE.md"), "CLAUDE.md is missing"],
    [
      "CLAUDE.md links elsewhere",
      () => {
        remove("CLAUDE.md");
        write("OTHER.md", RULES);
        symlinkSync("OTHER.md", join(repo, "CLAUDE.md"));
      },
      "CLAUDE.md links to 'OTHER.md'",
    ],
    [
      "CLAUDE.md arrived as a text file",
      () => {
        remove("CLAUDE.md");
        write("CLAUDE.md", "AGENTS.md");
      },
      "checked out as a text file",
    ],
    ["AGENTS.md is missing", () => remove("AGENTS.md"), "AGENTS.md is missing"],
    [
      "AGENTS.md is a symlink",
      () => {
        remove("CLAUDE.md");
        remove("AGENTS.md");
        write("CLAUDE.md", RULES);
        symlinkSync("CLAUDE.md", join(repo, "AGENTS.md"));
      },
      "AGENTS.md is a symlink",
    ],
    [
      "AGENTS.md has an @import",
      () => write("AGENTS.md", `${RULES}@docs/more.md\n`),
      "AGENTS.md has an @import line",
    ],
    [
      "AGENTS.md is an earlier run's output",
      () => write("AGENTS.md", `<!-- Generated from CLAUDE.md by codex-port -->\n\n${RULES}`),
      "AGENTS.md is the output of an earlier codex-port",
    ],
    [
      ".claude/CLAUDE.md imports AGENTS.md",
      () => write(".claude/CLAUDE.md", "@../AGENTS.md\n"),
      ".claude/CLAUDE.md imports AGENTS.md",
    ],
  ];

  test.each(refusals)("%s: the block converts nothing", (_name, arrange, message) => {
    arrange();
    const { code, out } = run(["--codex-only"]);
    expect(out).toContain(message);
    expect(code).not.toBe(0);
    expect(existsSync(join(repo, ".codex"))).toBe(false);
    expect(existsSync(join(repo, ".agents"))).toBe(false);
  });

  test.each(refusals)("%s: --check fails", (_name, arrange, message) => {
    expect(run(["--codex-only"]).code).toBe(0);
    arrange();
    const { code, out } = run(["--check"]);
    expect(out).toContain(message);
    expect(code).not.toBe(0);
  });
});

// OpenSpec 2.0 writes its skills once to .agents/skills/, which Codex reads, and links each
// into .claude/skills/ (AGENTS.md, Codex interop): the block ports none of them and never
// removes or overwrites their files. This is a local amendment to the vendored block.
describe("a skill linked into .agents/skills", () => {
  const SHARED = ".agents/skills/openspec-propose/SKILL.md";
  const TEXT = "---\nname: openspec-propose\ndescription: Use when proposing.\n---\nPropose.\n";

  beforeEach(() => {
    write(SHARED, TEXT);
    symlinkSync(
      "../../.agents/skills/openspec-propose",
      join(repo, ".claude/skills/openspec-propose"),
    );
  });

  test("is left to its owner: not ported, not listed, its file unchanged", () => {
    const { code, out } = run(["--codex-only"]);
    expect(out).toContain("rulesync 9.9.9 wrote 2 skills and 1 agents");
    expect(code).toBe(0);
    expect(read(SHARED)).toBe(TEXT);
    expect(read(".codex/codex-port.manifest")).not.toContain("openspec-propose");
  });

  test("passes --check", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    const { code, out } = run(["--check"]);
    expect(out).toContain("up to date (2 skills, 1 agents)");
    expect(code).toBe(0);
  });

  test("keeps its files when an earlier run's manifest lists them", () => {
    expect(run(["--codex-only"]).code).toBe(0);
    write(".codex/codex-port.manifest", `${read(".codex/codex-port.manifest")}${SHARED}\n`);
    expect(run(["--codex-only"]).code).toBe(0);
    expect(read(SHARED)).toBe(TEXT);
  });

  test("only a link to .agents/skills/<same name> counts: a link elsewhere is ported", () => {
    write(
      "elsewhere/gamma/SKILL.md",
      "---\nname: gamma\ndescription: Use when gamma.\n---\nGamma.\n",
    );
    symlinkSync(join(repo, "elsewhere/gamma"), join(repo, ".claude/skills/gamma"));
    const { code, out } = run(["--codex-only"]);
    expect(out).toContain("rulesync 9.9.9 wrote 3 skills and 1 agents");
    expect(code).toBe(0);
    expect(read(".agents/skills/gamma/SKILL.md")).toContain("Gamma.");
  });
});

// The part of setup.sh outside the block: the toolchain check, the install and --no-codex, which
// the CI jobs that need no Codex file use (.github/AGENTS.md, CI).
const STUB_BUN = `#!/bin/sh
case "$1" in
  --version) echo 1.2.3 ;;
  install) echo "stub bun $*" ;;
esac
`;

describe("--no-codex", () => {
  beforeEach(() => {
    write("package.json", '{ "packageManager": "bun@1.2.3" }\n');
    writeFileSync(join(bin, "bun"), STUB_BUN);
    chmodSync(join(bin, "bun"), 0o755);
  });

  test("installs the dependencies and writes no Codex file", () => {
    const { code, out } = run(["--ci", "--no-codex"]);
    expect(code).toBe(0);
    expect(out).toContain("stub bun install --frozen-lockfile");
    expect(out).not.toContain("codex-port");
    expect(existsSync(join(repo, ".agents"))).toBe(false);
    expect(existsSync(join(repo, ".codex"))).toBe(false);
  });

  test("without it the same run writes them", () => {
    const { code, out } = run(["--ci"]);
    expect(code).toBe(0);
    expect(out).toContain("rulesync 9.9.9 wrote 2 skills");
  });

  test("cannot be combined with an option that only runs the block", () => {
    for (const other of ["--codex-only", "--check", "--dry-run", "--force"]) {
      const { code, out } = run(["--no-codex", other]);
      expect(code).not.toBe(0);
      expect(out).toContain("--no-codex cannot be combined");
    }
  });
});
