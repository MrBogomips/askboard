import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// tools/ci/changed-paths.sh decides which parts of CI a change needs (CLAUDE.md, CI). The test
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
    ["CLAUDE.md"],
    [".claude/skills/askboard-implementation/SKILL.md"],
    [".claude/agents/askboard-architect.md"],
    ["setup.sh"],
    [".mcp.json"],
  ])("that changes %s needs the Codex files regenerated, and the check", (path) => {
    expect(decide("pull_request", [path])).toEqual({ code: "true", codex: "true" });
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
});
