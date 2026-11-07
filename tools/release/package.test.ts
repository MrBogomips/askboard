import { afterEach, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main, packageRelease } from "./package.ts";

// The release files (plugin-release, design decision 6): from the assembled tree, the notes of the
// version's CHANGELOG section, the bundle under its release name, the tree as a zip, and the SHA-256
// of both. Run on a fake tree; the workflow runs it on the real one.

const folders: string[] = [];
const folder = (): string => {
  const made = realpathSync(mkdtempSync(join(tmpdir(), "askboard-package-")));
  folders.push(made);
  return made;
};
afterEach(() => {
  for (const path of folders.splice(0)) rmSync(path, { recursive: true, force: true });
});

const CHANGELOG =
  "# Changelog\n\n## 0.2.0 - 2026-12-01\n\n- later\n\n## 9.8.7 - 2026-11-07\n\nThe first.\n\n- one\n- two\n\n## 0.0.1\n\n- old\n";
const BODY = "The first.\n\n- one\n- two\n";

const FILES: Record<string, string> = {
  ".claude-plugin/plugin.json": `${JSON.stringify({ name: "askboard", version: "9.8.7" })}\n`,
  ".claude-plugin/marketplace.json": "{}\n",
  "dist/askboard.mjs": "// the bundle\nexport {};\n",
  "dist/view/index.html": "<html></html>\n",
  "dist/view/chunks/a b.js": "// a name with a space\n",
  "scripts/askboard": "#!/bin/sh\nexit 0\n",
  "CHANGELOG.md": CHANGELOG,
  "README.md": "readme\n",
};

const textOf = (path: string): string => {
  const text = FILES[path];
  if (text === undefined) throw new Error(`no fixture ${path}`);
  return text;
};

const tree = (files: Record<string, string> = FILES): string => {
  const root = join(folder(), "tree");
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  chmodSync(join(root, "scripts", "askboard"), 0o755);
  return root;
};

const without = (path: string): Record<string, string> => {
  const copy = { ...FILES };
  delete copy[path];
  return copy;
};

const zipTools = Bun.which("zip") !== null && Bun.which("unzip") !== null;
const sumTool =
  Bun.which("sha256sum") !== null
    ? ["sha256sum"]
    : Bun.which("shasum") !== null
      ? ["shasum", "-a", "256"]
      : null;

describe("packageRelease", () => {
  test("writes the notes, the bundle, the zip and the sums, named by the version", async () => {
    const out = join(folder(), "out");
    const made = await packageRelease(tree(), out);
    expect(made.version).toBe("9.8.7");
    expect(readdirSync(out).sort()).toEqual([
      "SHA256SUMS",
      "askboard-9.8.7.mjs",
      "askboard-9.8.7.zip",
      "notes.md",
    ]);
    expect(made.files.sort()).toEqual(readdirSync(out).sort());
  });

  test("notes.md is the body of the version's CHANGELOG section", async () => {
    const out = join(folder(), "out");
    await packageRelease(tree(), out);
    expect(readFileSync(join(out, "notes.md"), "utf8")).toBe(BODY);
  });

  test("the bundle is the tree's, byte for byte", async () => {
    const out = join(folder(), "out");
    await packageRelease(tree(), out);
    expect(readFileSync(join(out, "askboard-9.8.7.mjs"), "utf8")).toBe(textOf("dist/askboard.mjs"));
  });

  test.skipIf(!zipTools)(
    "the zip lists exactly the tree's files, with their contents",
    async () => {
      const root = tree();
      const out = join(folder(), "out");
      await packageRelease(root, out);
      const listing = Bun.spawnSync(["unzip", "-Z1", join(out, "askboard-9.8.7.zip")]);
      expect(listing.stdout.toString().split("\n").filter(Boolean).sort()).toEqual(
        Object.keys(FILES).sort(),
      );
      const read = Bun.spawnSync([
        "unzip",
        "-p",
        join(out, "askboard-9.8.7.zip"),
        "dist/view/chunks/a b.js",
      ]);
      expect(read.stdout.toString()).toBe(textOf("dist/view/chunks/a b.js"));
    },
  );

  test.skipIf(!zipTools)("a tree inside the output folder is not in the zip", async () => {
    const root = tree();
    const out = join(root, "..");
    await packageRelease(root, out);
    const listing = Bun.spawnSync(["unzip", "-Z1", join(out, "askboard-9.8.7.zip")]);
    expect(listing.stdout.toString().split("\n").filter(Boolean).sort()).toEqual(
      Object.keys(FILES).sort(),
    );
  });

  test.skipIf(!zipTools || sumTool === null)(
    "SHA256SUMS names the bundle and the zip and verifies",
    async () => {
      const out = join(folder(), "out");
      await packageRelease(tree(), out);
      const lines = readFileSync(join(out, "SHA256SUMS"), "utf8").split("\n").filter(Boolean);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatch(/^[0-9a-f]{64} {2}askboard-9\.8\.7\.mjs$/);
      expect(lines[1]).toMatch(/^[0-9a-f]{64} {2}askboard-9\.8\.7\.zip$/);
      const check = (): number =>
        Bun.spawnSync([...(sumTool ?? []), "-c", "SHA256SUMS"], {
          cwd: out,
          stderr: "pipe",
          stdout: "pipe",
        }).exitCode;
      expect(check()).toBe(0);
      writeFileSync(join(out, "askboard-9.8.7.mjs"), "tampered\n");
      expect(check()).not.toBe(0);
    },
  );

  test("a CHANGELOG without the version's section fails naming it and writes nothing", async () => {
    const root = tree({ ...FILES, "CHANGELOG.md": "# Changelog\n\n## 0.2.0\n\n- x\n" });
    const out = join(folder(), "out");
    await expect(packageRelease(root, out)).rejects.toThrow("## 9.8.7");
    expect(existsSync(out) ? readdirSync(out) : []).toEqual([]);
  });

  test.each([
    ["the CHANGELOG", "CHANGELOG.md"],
    ["the bundle", "dist/askboard.mjs"],
    ["the plugin manifest", ".claude-plugin/plugin.json"],
  ])("a tree without %s fails naming the file", async (_name, missing) => {
    const out = join(folder(), "out");
    await expect(packageRelease(tree(without(missing)), out)).rejects.toThrow(missing);
    expect(existsSync(out) ? readdirSync(out) : []).toEqual([]);
  });

  test.each(["1.2", "v1.2.3", "1.2.3-beta", ""])(
    "a manifest version of %p is refused",
    async (version) => {
      const root = tree({
        ...FILES,
        ".claude-plugin/plugin.json": `${JSON.stringify({ version })}\n`,
      });
      await expect(packageRelease(root, join(folder(), "out"))).rejects.toThrow("version");
    },
  );

  test("a symbolic link in the tree is refused naming it", async () => {
    const root = tree();
    symlinkSync("/etc/hosts", join(root, "dist", "link"));
    const out = join(folder(), "out");
    await expect(packageRelease(root, out)).rejects.toThrow("dist/link");
    expect(existsSync(out) ? readdirSync(out) : []).toEqual([]);
  });

  test("an output file that exists is not overwritten", async () => {
    const out = join(folder(), "out");
    mkdirSync(out);
    writeFileSync(join(out, "notes.md"), "mine\n");
    await expect(packageRelease(tree(), out)).rejects.toThrow("notes.md");
    expect(readFileSync(join(out, "notes.md"), "utf8")).toBe("mine\n");
    expect(readdirSync(out)).toEqual(["notes.md"]);
  });

  test("an output folder inside the tree is refused", async () => {
    const root = tree();
    await expect(packageRelease(root, join(root, "release"))).rejects.toThrow("inside the tree");
    expect(existsSync(join(root, "release"))).toBe(false);
  });
});

describe("main, the command line", () => {
  const run = async (argv: string[]) => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await main(argv, {
      stdout: (line) => void out.push(line),
      stderr: (line) => void err.push(line),
    });
    return { code, out, err };
  };

  test.skipIf(!zipTools)("exits 0 and lists what it wrote", async () => {
    const out = join(folder(), "out");
    const ran = await run(["--tree", tree(), "--out", out]);
    expect(ran.code).toBe(0);
    expect(ran.out).toEqual([
      "package: wrote notes.md",
      "package: wrote askboard-9.8.7.mjs",
      "package: wrote askboard-9.8.7.zip",
      "package: wrote SHA256SUMS",
    ]);
    expect(ran.err).toEqual([]);
  });

  test("exits 1 with the reason when the release cannot be packaged", async () => {
    const ran = await run([
      "--tree",
      tree(without("CHANGELOG.md")),
      "--out",
      join(folder(), "out"),
    ]);
    expect(ran.code).toBe(1);
    expect(ran.err.join("\n")).toContain("package: ");
  });

  test.each([[[]], [["--tree", "x"]], [["--out", "y"]]])(
    "exits 2 for the arguments %p",
    async (argv) => {
      const ran = await run(argv);
      expect(ran.code).toBe(2);
      expect(ran.err.join("\n")).toContain("usage");
    },
  );
});
