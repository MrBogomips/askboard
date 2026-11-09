// The skill command and its drift check (askboard-skills, task 2.4; skills spec: skill files are
// generated; design decision 2), run on temporary copies: write mode, `--check`, and the
// confinement of every write and removal to `skills/askboard/`.

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { WIDGET_TYPES } from "@askboard/contract";
import { PROBE_WIDGET } from "@askboard/contract/fixtures";
import { generateSkill } from "./skills/generate.ts";
import { generateHelpSkill } from "./skills/help.ts";
import { main } from "./skills.ts";

// Whether the temporary volume treats `probe.txt` and `PROBE.TXT` as one file.
function caseInsensitiveVolume(): boolean {
  const probe = mkdtempSync(join(tmpdir(), "askboard-case-"));
  try {
    writeFileSync(join(probe, "probe.txt"), "p");
    return existsSync(join(probe, "PROBE.TXT"));
  } finally {
    rmSync(probe, { recursive: true, force: true });
  }
}

let root = "";
let dir = "";
let outside = "";
let log: string[] = [];

const write = (path: string, text: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

// Every file under a folder, by relative path, with its text.
const listing = (folder: string, prefix = ""): Record<string, string> =>
  Object.fromEntries(
    readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? Object.entries(listing(join(folder, entry.name), `${prefix}${entry.name}/`))
        : [[`${prefix}${entry.name}`, readFileSync(join(folder, entry.name), "utf8")]],
    ),
  );

const helpDir = () => join(dirname(dir), "askboard-help");
const run = (...args: string[]) => main(args, (line) => log.push(line), dir);
const said = () => log.join("\n");

beforeEach(() => {
  const base = mkdtempSync(join(tmpdir(), "askboard-skills-"));
  root = join(base, "plugin");
  outside = join(base, "outside");
  dir = join(root, "skills", "askboard");
  mkdirSync(root);
  write(join(outside, "secret.txt"), "keep");
  write(join(root, "README.md"), "readme");
  write(join(root, "skills", "other", "SKILL.md"), "another skill");
  log = [];
});

afterEach(() => rmSync(dirname(root), { recursive: true, force: true }));

const generated = (): Record<string, string> => Object.fromEntries(generateSkill().files);
const generatedHelp = (): Record<string, string> => Object.fromEntries(generateHelpSkill().files);

describe("write mode", () => {
  test("writes every generated file, byte for byte, and nothing else", async () => {
    expect(await run()).toBe(0);
    expect(listing(dir)).toEqual(generated());
  });

  test("overwrites a hand-edited file and removes a file and a folder nobody generates", async () => {
    await run();
    write(join(dir, "SKILL.md"), "edited");
    write(join(dir, "notes.txt"), "extra");
    write(join(dir, "references", "old", "gone.md"), "extra");
    expect(await run()).toBe(0);
    expect(listing(dir)).toEqual(generated());
    expect(existsSync(join(dir, "references", "old"))).toBe(false);
    expect(said()).toContain("notes.txt");
  });

  // Skipped on a case-sensitive temporary volume, where `skill.md` and `SKILL.md` are two files and
  // the collision this test is about cannot happen.
  test.skipIf(!caseInsensitiveVolume())(
    "keeps the file it wrote beside an extra one that differs only in case",
    async () => {
      write(join(dir, "skill.md"), "extra");
      write(join(dir, "references", "Answers.md"), "extra");
      expect(await run()).toBe(0);
      expect(listing(dir)).toEqual(generated());
      expect(await run("--check")).toBe(0);
    },
  );

  // Skipped on a case-sensitive volume, like the test above. The folders left empty go before the
  // writes: a `References/` folder is the generated `references/` on a case-insensitive volume.
  test.skipIf(!caseInsensitiveVolume())(
    "fixes a folder that differs from a generated one only in case, in one run",
    async () => {
      write(join(dir, "References", "answers.md"), "extra");
      write(join(dir, "References", "Widgets", "tree.md"), "extra");
      expect(await run()).toBe(0);
      const names = (readdirSync(dir, { recursive: true }) as string[]).sort();
      const expected = [
        ...new Set(
          Object.keys(generated()).flatMap((name) => {
            const parts = name.split("/");
            return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
          }),
        ),
      ].sort();
      expect(names).toEqual(expected);
      expect(await run("--check")).toBe(0);
      log = [];
      expect(await run()).toBe(0);
      expect(said()).not.toContain("removed");
    },
  );

  test("refuses a generated name outside the folder before it removes anything", async () => {
    write(join(dir, "keep-me.md"), "extra");
    write(join(root, "skills", "x.md"), "outside");
    const before = statSync(join(root, "skills", "x.md"));
    const good = generateSkill();
    const bad = { ...good, files: new Map([...good.files, ["../x.md", "overwritten"]]) };
    const code = await main([], (line) => log.push(line), dir, bad);
    expect(code).toBe(1);
    expect(said()).toContain("../x.md");
    expect(existsSync(join(dir, "keep-me.md"))).toBe(true);
    const after = statSync(join(root, "skills", "x.md"));
    expect(readFileSync(join(root, "skills", "x.md"), "utf8")).toBe("outside");
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  test("touches nothing outside the two skill folders", async () => {
    const outsideOwn = (folder: string) =>
      Object.fromEntries(
        Object.entries(listing(folder)).filter(
          ([path]) =>
            !path.startsWith("skills/askboard/") && !path.startsWith("skills/askboard-help/"),
        ),
      );
    const before = outsideOwn(root);
    await run();
    expect(outsideOwn(root)).toEqual(before);
    expect(listing(outside)).toEqual({ "secret.txt": "keep" });
  });
});

describe("--check", () => {
  test("passes on a folder equal to the generated one and writes nothing", async () => {
    await run();
    const before = listing(dir);
    expect(await run("--check")).toBe(0);
    expect(listing(dir)).toEqual(before);
  });

  test("fails on a hand-edited file, naming it", async () => {
    await run();
    write(join(dir, "references", "widgets", "tree.md"), "edited by hand");
    log = [];
    expect(await run("--check")).toBe(1);
    expect(said()).toContain("references/widgets/tree.md");
    expect(said()).toContain("differs");
    expect(readFileSync(join(dir, "references", "widgets", "tree.md"), "utf8")).toBe(
      "edited by hand",
    );
  });

  test("fails on a missing file, naming it", async () => {
    await run();
    rmSync(join(dir, "references", "molecules", "wbs-pert.md"));
    log = [];
    expect(await run("--check")).toBe(1);
    expect(said()).toContain("references/molecules/wbs-pert.md");
    expect(said()).toContain("missing");
  });

  test("fails on a file nobody generates, naming it, and does not remove it", async () => {
    await run();
    write(join(dir, "references", "stray.md"), "extra");
    log = [];
    expect(await run("--check")).toBe(1);
    expect(said()).toContain("references/stray.md");
    expect(said()).toContain("extra");
    expect(existsSync(join(dir, "references", "stray.md"))).toBe(true);
  });

  test("fails on a folder that does not exist yet, naming SKILL.md", async () => {
    expect(await run("--check")).toBe(1);
    expect(said()).toContain("SKILL.md");
    expect(existsSync(dir)).toBe(false);
  });

  test("a widget registered without regenerating fails, naming its reference and SKILL.md", async () => {
    await run();
    const extra = { ...PROBE_WIDGET, skill: { use: "a pick among options" } };
    log = [];
    const code = await main(
      ["--check"],
      (line) => log.push(line),
      dir,
      generateSkill({ widgets: [...WIDGET_TYPES, extra] }),
    );
    expect(code).toBe(1);
    expect(said()).toContain("references/widgets/probe.md");
    expect(said()).toContain("SKILL.md");
  });

  test("prints each figure with its budget, the always-loaded total included", async () => {
    await run();
    log = [];
    expect(await run("--check")).toBe(0);
    expect(said()).toMatch(/description: [\d,]+ of 600 characters/);
    expect(said()).toMatch(/SKILL\.md: [\d,]+ of 9,000 characters/);
    expect(said()).toMatch(/references\/widgets\/tree\.md: [\d,]+ of 6,000 characters/);
    expect(said()).toMatch(/always-loaded total: [\d,]+ of 8,400 characters/);
  });

  test("fails on a reference over its budget even when the folder holds exactly what was generated", async () => {
    const base = generateSkill();
    const files = new Map(base.files).set("references/widgets/tree.md", "x".repeat(6001));
    const big = { ...base, files };
    expect(await main([], (line) => log.push(line), dir, big)).toBe(1);
    log = [];
    expect(await main(["--check"], (line) => log.push(line), dir, big)).toBe(1);
    expect(said()).toContain(
      "references/widgets/tree.md has 6,001 characters, over its budget of 6,000",
    );
  });

  test("refuses an argument it does not know", async () => {
    expect(await run("--fix")).toBe(1);
    expect(said()).toContain("--fix");
  });
});

describe("symlinks", () => {
  test("refuses a symlinked folder under skills/askboard/ in both modes, its target untouched", async () => {
    await run();
    symlinkSync(outside, join(dir, "references", "linked"));
    for (const args of [[], ["--check"]]) {
      log = [];
      expect(await run(...args)).toBe(1);
      expect(said()).toContain("references/linked");
      expect(said()).toContain("symlink");
    }
    expect(listing(outside)).toEqual({ "secret.txt": "keep" });
  });

  test("refuses a symlink in place of a generated file, and writes nothing through it", async () => {
    mkdirSync(dir, { recursive: true });
    symlinkSync(join(outside, "secret.txt"), join(dir, "SKILL.md"));
    expect(await run()).toBe(1);
    expect(said()).toContain("SKILL.md");
    expect(readFileSync(join(outside, "secret.txt"), "utf8")).toBe("keep");
    expect(existsSync(join(dir, "references"))).toBe(false);
  });

  test("refuses when skills or skills/askboard is itself a symlink", async () => {
    rmSync(join(root, "skills"), { recursive: true });
    symlinkSync(outside, join(root, "skills"));
    expect(await run()).toBe(1);
    expect(said()).toContain("symlink");
    expect(listing(outside)).toEqual({ "secret.txt": "keep" });

    rmSync(join(root, "skills"));
    mkdirSync(join(root, "skills"));
    symlinkSync(outside, join(root, "skills", "askboard"));
    log = [];
    expect(await run()).toBe(1);
    expect(listing(outside)).toEqual({ "secret.txt": "keep" });
  });
});

describe("the help skill's folder", () => {
  test("write mode writes both folders, byte for byte", async () => {
    expect(await run()).toBe(0);
    expect(listing(dir)).toEqual(generated());
    expect(listing(helpDir())).toEqual(generatedHelp());
    expect(said()).toContain("askboard-help: description:");
  });

  test("overwrites a hand-edited help file and removes an extra one", async () => {
    await run();
    write(join(helpDir(), "SKILL.md"), "edited");
    write(join(helpDir(), "references", "stray.md"), "extra");
    log = [];
    expect(await run()).toBe(0);
    expect(listing(helpDir())).toEqual(generatedHelp());
    expect(said()).toContain("removed skills/askboard-help/references/stray.md");
  });

  test("--check passes on both, and fails naming a hand-edited, missing or extra help file", async () => {
    await run();
    expect(await run("--check")).toBe(0);
    write(join(helpDir(), "references", "widgets", "ranking.md"), "edited by hand");
    rmSync(join(helpDir(), "references", "key-actions.md"));
    write(join(helpDir(), "references", "stray.md"), "extra");
    log = [];
    expect(await run("--check")).toBe(1);
    expect(said()).toContain("differs: skills/askboard-help/references/widgets/ranking.md");
    expect(said()).toContain("missing: skills/askboard-help/references/key-actions.md");
    expect(said()).toContain("extra: skills/askboard-help/references/stray.md");
    expect(existsSync(join(helpDir(), "references", "stray.md"))).toBe(true);
  });

  test("--check fails on a folder not generated yet, naming its SKILL.md", async () => {
    await run();
    rmSync(helpDir(), { recursive: true });
    log = [];
    expect(await run("--check")).toBe(1);
    expect(said()).toContain("missing: skills/askboard-help/SKILL.md");
  });

  test("a symlink at the help folder is refused in both modes before anything is written", async () => {
    write(join(dir, "keep.md"), "extra");
    symlinkSync(outside, helpDir());
    for (const args of [[], ["--check"]]) {
      log = [];
      expect(await run(...args)).toBe(1);
      expect(said()).toContain("askboard-help");
      expect(said()).toContain("symlink");
    }
    expect(existsSync(join(dir, "keep.md"))).toBe(true);
    expect(existsSync(join(dir, "SKILL.md"))).toBe(false);
    expect(listing(outside)).toEqual({ "secret.txt": "keep" });
  });

  test("a symlink under the help folder is refused before the other folder is written", async () => {
    mkdirSync(helpDir(), { recursive: true });
    symlinkSync(outside, join(helpDir(), "linked"));
    expect(await run()).toBe(1);
    expect(said()).toContain("linked");
    expect(existsSync(join(dir, "SKILL.md"))).toBe(false);
    expect(listing(outside)).toEqual({ "secret.txt": "keep" });
  });

  test("a symlink where the skills folder should be is refused", async () => {
    const other = join(dirname(root), "elsewhere");
    mkdirSync(other);
    rmSync(join(root, "skills"), { recursive: true });
    symlinkSync(other, join(root, "skills"));
    expect(await run()).toBe(1);
    expect(said()).toContain("symlink");
    expect(readdirSync(other)).toEqual([]);
  });

  test("refuses a generated help name outside the folder before it removes or writes anything", async () => {
    write(join(dir, "keep-me.md"), "extra");
    const good = generateHelpSkill();
    const bad = { files: new Map([...good.files, ["../../escape.md", "x"]]) };
    const code = await main([], (line) => log.push(line), dir, generateSkill(), helpDir(), bad);
    expect(code).toBe(1);
    expect(said()).toContain("escape.md");
    expect(existsSync(join(dir, "keep-me.md"))).toBe(true);
    expect(existsSync(join(dir, "SKILL.md"))).toBe(false);
    expect(existsSync(join(root, "escape.md"))).toBe(false);
  });

  test("a help reference over its 4,000-character budget fails the command", async () => {
    const good = generateHelpSkill();
    const big = { files: new Map(good.files).set("references/widgets/tree.md", "x".repeat(4001)) };
    const code = await main([], (line) => log.push(line), dir, generateSkill(), helpDir(), big);
    expect(code).toBe(1);
    expect(said()).toContain(
      "askboard-help: references/widgets/tree.md has 4,001 characters, over its budget of 4,000",
    );
  });

  test("the always-loaded total is printed once and counts both skills", async () => {
    await run();
    log = [];
    expect(await run("--check")).toBe(0);
    expect(log.filter((line) => line.includes("always-loaded total"))).toHaveLength(1);
  });

  test("touches nothing but the two skill folders", async () => {
    const outsideOwn = Object.entries(listing(root)).filter(
      ([path]) => !path.startsWith("skills/askboard/") && !path.startsWith("skills/askboard-help/"),
    );
    await run();
    expect(
      Object.entries(listing(root)).filter(
        ([path]) =>
          !path.startsWith("skills/askboard/") && !path.startsWith("skills/askboard-help/"),
      ),
    ).toEqual(outsideOwn);
  });
});

describe("a key table changed without regenerating", () => {
  test("fails the check naming the type's two references", async () => {
    await run();
    const widgets = WIDGET_TYPES.map((entry) =>
      entry.type === "ranking"
        ? { ...entry, keys: (entry.keys ?? []).filter(({ action }) => action !== "ranking.keep") }
        : entry,
    );
    log = [];
    const code = await main(
      ["--check"],
      (line) => log.push(line),
      dir,
      generateSkill({ widgets }),
      helpDir(),
      generateHelpSkill({ widgets }),
    );
    expect(code).toBe(1);
    expect(said()).toContain("differs: skills/askboard/references/widgets/ranking.md");
    expect(said()).toContain("differs: skills/askboard-help/references/widgets/ranking.md");
  });
});
