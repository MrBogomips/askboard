import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// tools/ci/changed-paths.sh decides which parts of CI a change needs (.github/AGENTS.md, CI). The test
// builds a scratch repository whose HEAD is a commit on top of a base, as a pull request's merge
// commit is, and runs the script on it.
const ROOT = join(import.meta.dir, "..", "..");
const SCRIPT = join(import.meta.dir, "changed-paths.sh");

let repo: string;

function git(...args: string[]): void {
  const result = Bun.spawnSync(
    ["git", "-c", "user.name=t", "-c", "user.email=t@example.test", ...args],
    { cwd: repo },
  );
  if (result.exitCode !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
}

function commit(paths: string[]): void {
  for (const path of paths) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), `${path} ${Math.random()}\n`);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "change");
}

function decide(event: string, changed: string[]): { code: string; codex: string } {
  commit(changed);
  return run(event);
}

// The merge commit of a pull request that only renames `from` to `to`.
function decideRename(from: string, to: string): { code: string; codex: string } {
  commit([from]);
  mkdirSync(dirname(join(repo, to)), { recursive: true });
  git("mv", from, to);
  git("commit", "-q", "-m", "rename");
  return run("pull_request");
}

function run(event: string): { code: string; codex: string } {
  const result = Bun.spawnSync(["sh", SCRIPT], {
    cwd: repo,
    env: { ...process.env, GITHUB_EVENT_NAME: event },
  });
  expect(result.exitCode).toBe(0);
  const lines = result.stdout.toString().trim().split("\n");
  const value = (key: string): string =>
    lines.find((line) => line.startsWith(`${key}=`))?.slice(key.length + 1) ?? "missing";
  return { code: value("code"), codex: value("codex") };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "changed-paths-"));
  git("init", "-q", "-b", "main");
  commit(["README.md"]);
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("a pull request", () => {
  test.each([
    [["docs/as-built/some-change.md"]],
    [
      [
        "openspec/changes/some-change/tasks.md",
        "openspec/specs/view/spec.md",
        "openspec/config.yaml",
      ],
    ],
    [["drafts/notes.md", "ROADMAP.md", "README.md"]],
    [["docs/ux-askboard-2026-10-27/EXPERIENCE.md"]],
    // Only the folder the contract tests read is code.
    [["openspec/changes/archive/2026-11-01-some-change/proposal.md"]],
  ])("that changes only documents needs no check: %j", (changed) => {
    expect(decide("pull_request", changed)).toEqual({ code: "false", codex: "false" });
  });

  test.each([
    ["packages/core/src/core.ts"],
    ["tools/check-imports.ts"],
    ["package.json"],
    [".github/workflows/check.yml"],
    ["skills/askboard/SKILL.md"],
    ["packages/contract/README.md"],
    ["hooks/hooks.json"],
    ["CHANGELOG.md"],
    // The contract tests read the approved examples.
    ["openspec/changes/archive/2026-10-29-review-model-contract/examples/gantt.json"],
    // Tests and the view build read these three documents.
    ["docs/ux-askboard-2026-10-27/DESIGN.md"],
    ["docs/prd-askboard-2026-10-25/addendum.md"],
    ["docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md"],
  ])("that changes %s needs the check", (path) => {
    expect(decide("pull_request", [path]).code).toBe("true");
  });

  test("one source file among documents needs the check", () => {
    expect(decide("pull_request", ["docs/a.md", "packages/core/src/core.ts"]).code).toBe("true");
  });

  test.each([
    ["AGENTS.md"],
    ["CLAUDE.md"],
    [".claude/CLAUDE.md"],
    [".claude/skills/askboard-implementation/SKILL.md"],
    [".claude/agents/askboard-architect.md"],
    ["setup.sh"],
    [".mcp.json"],
  ])("that changes %s needs the Codex files regenerated, and the check", (path) => {
    expect(decide("pull_request", [path])).toEqual({ code: "true", codex: "true" });
  });

  // A nested instruction file is Markdown of its folder for the check, and a Codex source.
  test("that changes docs/AGENTS.md needs the Codex files regenerated, not the check", () => {
    expect(decide("pull_request", ["docs/AGENTS.md"])).toEqual({ code: "false", codex: "true" });
  });

  test.each([[".github/AGENTS.md"], ["tools/AGENTS.md"]])(
    "that changes %s needs the Codex files regenerated, and the check",
    (path) => {
      expect(decide("pull_request", [path])).toEqual({ code: "true", codex: "true" });
    },
  );

  test("that renames code into docs/ needs the check", () => {
    expect(decideRename("packages/core/src/core.ts", "docs/core.ts").code).toBe("true");
  });

  test("that renames a Codex source away needs the Codex files regenerated", () => {
    expect(decideRename("AGENTS.md", "drafts/AGENTS.md")).toEqual({ code: "true", codex: "true" });
  });

  test("that changes no Codex source leaves the Codex job out", () => {
    expect(decide("pull_request", ["packages/core/src/core.ts"]).codex).toBe("false");
  });

  test("whose diff cannot be read runs everything", () => {
    const result = Bun.spawnSync(["sh", SCRIPT], {
      cwd: repo,
      env: { ...process.env, GITHUB_EVENT_NAME: "pull_request" },
    });
    // The scratch repository has one commit only: HEAD has no first parent.
    expect(result.stdout.toString()).toContain("code=true");
    expect(result.stdout.toString()).toContain("codex=true");
  });
});

describe("a push to main", () => {
  test("always runs the check, and the Codex job when a source changed", () => {
    expect(decide("push", ["docs/a.md"])).toEqual({ code: "true", codex: "false" });
    expect(decide("push", ["setup.sh"])).toEqual({ code: "true", codex: "true" });
  });
});

describe("the nightly run and a manual dispatch", () => {
  test.each(["schedule", "workflow_dispatch"])("%s runs everything", (event) => {
    expect(decide(event, ["docs/a.md"])).toEqual({ code: "true", codex: "true" });
  });
});

describe("the documents the tests read", () => {
  test("the three files the script keeps in the check exist", () => {
    for (const file of [
      "docs/ux-askboard-2026-10-27/DESIGN.md",
      "docs/prd-askboard-2026-10-25/addendum.md",
      "docs/architecture-askboard-2026-10-27/ARCHITECTURE-SPINE.md",
    ]) {
      expect(existsSync(join(ROOT, file))).toBe(true);
    }
  });

  test("the approved examples folder the script keeps in the check exists, and tests read it", () => {
    const folder = "openspec/changes/archive/2026-10-29-review-model-contract/examples";
    expect(existsSync(join(ROOT, folder))).toBe(true);
    const reader = Bun.spawnSync(
      ["git", "grep", "-l", "review-model-contract/examples", "--", "packages"],
      {
        cwd: ROOT,
      },
    );
    expect(reader.stdout.toString()).toContain("approved-examples.test.ts");
  });
});
