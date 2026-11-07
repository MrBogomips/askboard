import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLAUDE_CODE_MINIMUM } from "@askboard/contract";
import {
  compareVersions,
  distTagsFromNpm,
  type PreflightInput,
  portsWith,
  preflight,
  runCommand,
  runPreflight,
} from "./preflight.ts";

const repositoryRoot = join(import.meta.dir, "..", "..");
const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

/** A miniature checkout: the root and plugin manifests, one package, and a CHANGELOG. */
const checkout = (
  options: { root?: string; plugin?: string; changelog?: string | null } = {},
): string => {
  const root = mkdtempSync(join(tmpdir(), "askboard-preflight-"));
  temporary.push(root);
  const write = (path: string, text: string) => {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  const manifest = (name: string, version: string) =>
    `${JSON.stringify({ name, version }, null, 2)}\n`;
  write("package.json", manifest("askboard", options.root ?? "0.1.0"));
  write(".claude-plugin/plugin.json", manifest("askboard", options.plugin ?? "0.1.0"));
  write("packages/a/package.json", manifest("@askboard/a", "0.1.0"));
  if (options.changelog !== null) {
    write(
      "CHANGELOG.md",
      options.changelog ?? "# Changelog\n\n## 0.1.0 - 2026-11-07\n\n- the first release\n",
    );
  }
  return root;
};

/** The inputs of a release that passes every gate, with `overrides`. */
const passing = (overrides: Partial<PreflightInput> = {}): PreflightInput => ({
  root: checkout(),
  ref: "refs/heads/main",
  remoteTags: ["v0.0.1"],
  distTags: { stable: CLAUDE_CODE_MINIMUM, latest: "2.1.319" },
  ...overrides,
});

describe("preflight", () => {
  test("passes on main, agreeing versions, no tag, a CHANGELOG section and a stable channel at the minimum", () => {
    expect(preflight(passing())).toEqual([]);
  });

  test.each([
    ["a branch", "refs/heads/feature"],
    ["a tag", "refs/tags/v0.1.0"],
    ["a pull request", "refs/pull/5/merge"],
    ["an empty ref", ""],
    ["no ref", undefined],
  ])("fails on %s, naming the ref", (_name, ref) => {
    const problems = preflight(passing({ ref }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("refs/heads/main");
    expect(problems[0]).toContain(ref === undefined || ref === "" ? "no ref" : ref);
  });

  test("fails when the tag of the version exists, naming it", () => {
    const problems = preflight(passing({ remoteTags: ["v0.0.1", "v0.1.0"] }));
    expect(problems).toEqual(["the tag v0.1.0 already exists: a released version is never moved"]);
  });

  test("a tag that only looks like the version's does not fail", () => {
    expect(
      preflight(passing({ remoteTags: ["v0.1.00", "v0.1.0-beta", "0.1.0", "v10.1.0"] })),
    ).toEqual([]);
  });

  test("fails when versions disagree, naming the file and both versions", () => {
    const problems = preflight(passing({ root: checkout({ plugin: "0.2.0" }) }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(".claude-plugin/plugin.json");
    expect(problems[0]).toContain("0.2.0");
    expect(problems[0]).toContain("0.1.0");
  });

  test("fails when the root has no version, and then checks no tag or CHANGELOG", () => {
    const root = checkout();
    writeFileSync(join(root, "package.json"), '{ "name": "askboard" }\n');
    const problems = preflight(passing({ root }));
    expect(problems.join("\n")).toContain("package.json: has no version");
    expect(problems.join("\n")).not.toContain("CHANGELOG");
  });

  test("fails when the root manifest is no JSON object, and checks no tag or CHANGELOG", () => {
    const root = checkout();
    writeFileSync(join(root, "package.json"), "[]\n");
    const problems = preflight(passing({ root }));
    expect(problems.join("\n")).toContain("package.json: cannot be read");
    expect(problems.join("\n")).not.toContain("CHANGELOG");
  });

  test("fails when CHANGELOG.md has no section for the version, naming the heading", () => {
    const problems = preflight(
      passing({ root: checkout({ changelog: "# Changelog\n\n## 0.0.9 - 2026-01-01\n\n- x\n" }) }),
    );
    expect(problems).toEqual(["CHANGELOG.md has no section `## 0.1.0`"]);
  });

  test("fails when CHANGELOG.md is missing", () => {
    const problems = preflight(passing({ root: checkout({ changelog: null }) }));
    expect(problems).toEqual([
      "CHANGELOG.md is missing or unreadable: it needs a section `## 0.1.0`",
    ]);
  });

  test("fails when stable is below the minimum, naming both", () => {
    const problems = preflight(passing({ distTags: { stable: "2.1.310" } }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("stable");
    expect(problems[0]).toContain("2.1.310");
    expect(problems[0]).toContain(CLAUDE_CODE_MINIMUM);
  });

  test("passes when stable is above the minimum, comparing numbers and not text", () => {
    expect(preflight(passing({ distTags: { stable: "2.1.1000" } }))).toEqual([]);
    expect(preflight(passing({ distTags: { stable: "2.10.0" } }))).toEqual([]);
    expect(preflight(passing({ distTags: { stable: "3.0.0" } }))).toEqual([]);
    expect(preflight(passing({ distTags: { stable: "2.1.311" }, minimum: "2.1.1000" }))).toEqual([
      expect.stringContaining("2.1.1000"),
    ]);
    expect(preflight(passing({ distTags: { stable: "2.1.1000" }, minimum: "2.1.311" }))).toEqual(
      [],
    );
  });

  test.each([
    ["not a version", { stable: "latest" }],
    ["a pre-release", { stable: "2.1.400-beta.1" }],
    ["a number", { stable: 2 }],
    ["empty", { stable: "" }],
    ["missing", { latest: "2.1.319" }],
    ["a list", []],
    ["a string", "2.1.311"],
    ["null", null],
    ["undefined", undefined],
  ])("fails when the stable tag is %s", (_name, distTags) => {
    const problems = preflight(passing({ distTags }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("stable");
    expect(problems[0]).toContain("not a version");
  });

  test("reports every cause at once", () => {
    const problems = preflight(
      passing({
        ref: "refs/heads/dev",
        remoteTags: ["v0.1.0"],
        distTags: { stable: "2.1.1" },
        root: checkout({ changelog: "# none\n" }),
      }),
    );
    expect(problems).toHaveLength(4);
  });
});

describe("compareVersions", () => {
  test("compares each number as a number", () => {
    expect(compareVersions("2.1.311", "2.1.1000")).toBeLessThan(0);
    expect(compareVersions("2.1.1000", "2.1.311")).toBeGreaterThan(0);
    expect(compareVersions("2.1.311", "2.1.311")).toBe(0);
    expect(compareVersions("2.9.0", "2.10.0")).toBeLessThan(0);
    expect(compareVersions("10.0.0", "9.9.9")).toBeGreaterThan(0);
  });
});

describe("distTagsFromNpm", () => {
  test("parses npm's JSON object", () => {
    expect(distTagsFromNpm('{"stable":"2.1.311","latest":"2.1.319"}\n')).toEqual({
      stable: "2.1.311",
      latest: "2.1.319",
    });
  });

  test("gives undefined for what is not JSON", () => {
    expect(distTagsFromNpm("npm error 404")).toBeUndefined();
    expect(distTagsFromNpm("")).toBeUndefined();
  });
});

describe("runPreflight", () => {
  const ports = (overrides: Partial<Parameters<typeof runPreflight>[1]> = {}) => {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      ports: {
        env: { GITHUB_REF: "refs/heads/main" } as Record<string, string | undefined>,
        tags: () => ["v0.0.1"],
        distTags: () => ({ stable: CLAUDE_CODE_MINIMUM }),
        stdout: (line: string) => void out.push(line),
        stderr: (line: string) => void err.push(line),
        ...overrides,
      },
    };
  };

  test("exits 0 and says the version when every gate passes", () => {
    const run = ports();
    expect(runPreflight(checkout(), run.ports)).toBe(0);
    expect(run.out).toEqual(["preflight: 0.1.0 may be released"]);
    expect(run.err).toEqual([]);
  });

  test("exits 1 with one line per cause", () => {
    const run = ports({ env: { GITHUB_REF: "refs/heads/other" } });
    expect(runPreflight(checkout({ changelog: null }), run.ports)).toBe(1);
    expect(run.out).toEqual([]);
    expect(run.err).toHaveLength(2);
    expect(run.err.every((line) => line.startsWith("preflight: "))).toBe(true);
  });

  test("exits 1 when the tags or the npm query cannot be read, and does not release", () => {
    const failing = ports({
      tags: () => {
        throw new Error("git failed");
      },
    });
    expect(runPreflight(checkout(), failing.ports)).toBe(1);
    expect(failing.err.join("\n")).toContain("git failed");
    const noNpm = ports({
      distTags: () => {
        throw new Error("npm view failed");
      },
    });
    expect(runPreflight(checkout(), noNpm.ports)).toBe(1);
    expect(noNpm.err.join("\n")).toContain("npm view failed");
  });
});

describe("the real ports", () => {
  test("runCommand returns stdout and throws with the stderr of a failing command", () => {
    expect(runCommand(["git", "--version"], repositoryRoot)).toStartWith("git version");
    expect(() => runCommand(["git", "no-such-subcommand"], repositoryRoot)).toThrow(
      /git no-such-subcommand exited [0-9]+: .*no-such-subcommand/,
    );
  });

  test("tags are one per line of git tag --list in the root; dist-tags are npm's parsed JSON", () => {
    const calls: string[][] = [];
    const ports = portsWith((command) => {
      calls.push(command);
      return command[0] === "git" ? "v0.0.1\nv0.1.0\n" : '{"stable":"2.1.311"}';
    });
    expect(ports.tags(repositoryRoot)).toEqual(["v0.0.1", "v0.1.0"]);
    expect(ports.distTags()).toEqual({ stable: "2.1.311" });
    expect(calls).toEqual([
      ["git", "tag", "--list"],
      ["npm", "view", "@anthropic-ai/claude-code", "dist-tags", "--json"],
    ]);
  });

  test("npm output that is no JSON is an error, not an empty answer", () => {
    expect(() => portsWith(() => "npm error").distTags()).toThrow("npm view printed no JSON");
  });

  test("the lines go to stdout and stderr", () => {
    const out = spyOn(process.stdout, "write").mockImplementation(() => true);
    const err = spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const ports = portsWith(() => "");
      ports.stdout("a");
      ports.stderr("b");
      expect(out).toHaveBeenCalledWith("a\n");
      expect(err).toHaveBeenCalledWith("b\n");
    } finally {
      out.mockRestore();
      err.mockRestore();
    }
  });
});

describe("the real repository", () => {
  test("agrees on its versions and has the declared Claude Code minimum in the contract", () => {
    // The ref, tag and stable channel are the workflow's; here only what the repository holds.
    const problems = preflight({
      root: repositoryRoot,
      ref: "refs/heads/main",
      remoteTags: [],
      distTags: { stable: CLAUDE_CODE_MINIMUM },
    });
    // CHANGELOG.md arrives with task 4.2: until then it is the only thing the real run may lack.
    expect(problems.filter((line) => !line.startsWith("CHANGELOG.md"))).toEqual([]);
  });
});
