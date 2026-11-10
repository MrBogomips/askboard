import { afterAll, describe, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assemble, main } from "./assemble.ts";

// The release tree (plugin-release, design decision 4; packaging spec, "The release tree" and "The
// marketplace on the release branch"). Every test assembles from a miniature built checkout.

const folders: string[] = [];
const temporary = (prefix: string): string => {
  const made = mkdtempSync(join(tmpdir(), prefix));
  folders.push(made);
  return made;
};

afterAll(() => {
  for (const path of folders) rmSync(path, { recursive: true, force: true });
});

const NOTICES = "# Third-party notices\n\nfrom the injected port\n";
const ports = { notices: async () => NOTICES };

const PLUGIN = {
  name: "askboard",
  version: "0.1.0",
  description: "A board for an agent's questions.",
  license: "MIT",
};

/** What the tree holds from the checkout, by path: the sources the assembly copies. */
const COPIED: Record<string, string> = {
  ".claude-plugin/plugin.json": `${JSON.stringify(PLUGIN, null, 2)}\n`,
  "hooks/hooks.json": '{"hooks":{}}\n',
  "hooks/askboard-mod.js": "export const register = () => {};\n",
  "scripts/askboard": '#!/bin/sh\nexec node "$0"\n',
  "dist/askboard.mjs": "// bundle\n",
  "dist/view/board-page.html": "<html></html>\n",
  "dist/view/manifest.json": "{}\n",
  "dist/view/chunks/shell.js": "// shell\n",
  "dist/view/licences/react-19.txt": "MIT\n",
  "skills/askboard/SKILL.md": "# skill\n",
  "skills/askboard/references/widgets/tree.md": "# tree\n",
  "skills/askboard-help/SKILL.md": "# help\n",
  "skills/askboard-help/references/widgets/tree.md": "# tree help\n",
  LICENSE: "MIT License\n\nCopyright (c) 2026 Ada Lovelace\n\nPermission is hereby granted\n",
  "README.md": "# AskBoard\n",
  "CHANGELOG.md": "# Changelog\n\n## 0.1.0 - 2026-11-07\n",
};

/** Files a checkout holds that the tree must not. */
const NOISE: Record<string, string> = {
  "package.json": '{"name":"askboard","version":"0.1.0"}\n',
  "bun.lock": "{}\n",
  "CLAUDE.md": "# guide\n",
  "packages/a/src/index.ts": "export {};\n",
  "dist/other.js": "// not the view\n",
  "hooks/notes.md": "x\n",
  "scripts/other": "x\n",
  "skills/other/SKILL.md": "x\n",
  "skills/askboard-helper/SKILL.md": "x\n",
  "docs/prd.md": "x\n",
  "tools/release/assemble.ts": "x\n",
  "bin/askboard": "x\n",
  "agents/helper.md": "x\n",
};

const write = (root: string, path: string, text: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const checkout = (
  options: { without?: string[]; versionOf?: Record<string, string> } = {},
): string => {
  const root = temporary("askboard-assemble-checkout-");
  for (const [path, text] of Object.entries({ ...COPIED, ...NOISE })) write(root, path, text);
  write(root, "packages/a/package.json", '{"name":"@askboard/a","version":"0.1.0"}\n');
  chmodSync(join(root, "scripts/askboard"), 0o755);
  for (const [path, version] of Object.entries(options.versionOf ?? {})) {
    const file = join(root, path);
    writeFileSync(
      file,
      readFileSync(file, "utf8").replace(/"version": ?"[^"]*"/, `"version": "${version}"`),
    );
  }
  for (const path of options.without ?? []) rmSync(join(root, path), { recursive: true });
  return root;
};

/** A path for the tree that does not exist yet. */
const target = (): string => join(temporary("askboard-assemble-out-"), "tree");

const filesUnder = (dir: string, prefix = ""): string[] =>
  readdirSync(join(dir, prefix), { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory() ? filesUnder(dir, `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
    )
    .sort();

describe("assemble", () => {
  test("the output holds exactly the allowlist, each copied file byte-identical", async () => {
    const root = checkout();
    const out = target();
    const result = await assemble(root, out, ports);
    const expected = [
      ...Object.keys(COPIED),
      ".claude-plugin/marketplace.json",
      "THIRD-PARTY-NOTICES.md",
    ].sort();
    expect(filesUnder(out)).toEqual(expected);
    expect(result.files).toEqual(expected);
    for (const path of Object.keys(COPIED)) {
      expect(readFileSync(join(out, path)).equals(readFileSync(join(root, path)))).toBe(true);
    }
    expect(readFileSync(join(out, "THIRD-PARTY-NOTICES.md"), "utf8")).toBe(NOTICES);
    expect(result.bytes).toBeGreaterThan(0);
  });

  test("none of the checkout's other files is in the tree", async () => {
    const out = target();
    await assemble(checkout(), out, ports);
    for (const path of Object.keys(NOISE)) expect(existsSync(join(out, path))).toBe(false);
    const names = filesUnder(out).map((path) => path.split("/").pop());
    expect(names).not.toContain("package.json");
    expect(names).not.toContain("bun.lock");
    expect(names).not.toContain("CLAUDE.md");
    expect(existsSync(join(out, "bin"))).toBe(false);
    expect(existsSync(join(out, "agents"))).toBe(false);
  });

  test("the marketplace names the marketplace, its owner and one plugin with source ./ and no version", async () => {
    const out = target();
    await assemble(checkout(), out, ports);
    const text = readFileSync(join(out, ".claude-plugin/marketplace.json"), "utf8");
    const marketplace = JSON.parse(text);
    expect(marketplace.name).toBe("askboard");
    expect(marketplace.owner).toEqual({ name: "Ada Lovelace" });
    expect(marketplace.metadata.description).toBe(PLUGIN.description);
    expect(marketplace.plugins).toEqual([
      { name: "askboard", source: "./", description: PLUGIN.description },
    ]);
    expect(text).not.toContain('"version"');
    expect(text.endsWith("}\n")).toBe(true);
  });

  test("the start script keeps its executable bit", async () => {
    const out = target();
    await assemble(checkout(), out, ports);
    expect(lstatSync(join(out, "scripts/askboard")).mode & 0o111).not.toBe(0);
  });

  test("an existing empty folder is filled", async () => {
    const out = temporary("askboard-assemble-empty-");
    await assemble(checkout(), out, ports);
    expect(existsSync(join(out, "scripts/askboard"))).toBe(true);
  });
});

describe("assemble refuses and leaves no tree", () => {
  const refused = async (root: string, pattern: RegExp, out = target()) => {
    await expect(assemble(root, out, ports)).rejects.toThrow(pattern);
    expect(existsSync(out) ? readdirSync(out) : []).toEqual([]);
  };

  test("a missing bundle", () =>
    refused(checkout({ without: ["dist/askboard.mjs"] }), /dist\/askboard\.mjs/));
  test("a missing mod", () =>
    refused(checkout({ without: ["hooks/askboard-mod.js"] }), /hooks\/askboard-mod\.js/));
  test("a missing view build", () => refused(checkout({ without: ["dist/view"] }), /dist\/view/));
  test("a missing CHANGELOG", () =>
    refused(checkout({ without: ["CHANGELOG.md"] }), /CHANGELOG\.md/));

  test("every missing input is named together", async () => {
    const root = checkout({ without: ["dist/askboard.mjs", "hooks/askboard-mod.js"] });
    const failure = assemble(root, target(), ports);
    await expect(failure).rejects.toThrow(/dist\/askboard\.mjs/);
    await expect(failure).rejects.toThrow(/hooks\/askboard-mod\.js/);
  });

  test("a symbolic link in dist/view", () => {
    const root = checkout();
    symlinkSync("/etc/hosts", join(root, "dist/view/chunks/link.js"));
    return refused(root, /dist\/view\/chunks\/link\.js.*symbolic link/);
  });

  test("a symbolic link in skills", () => {
    const root = checkout();
    symlinkSync("../../README.md", join(root, "skills/askboard/link.md"));
    return refused(root, /skills\/askboard\/link\.md.*symbolic link/);
  });

  test("a symbolic link in the help skill, and a missing help skill", async () => {
    const root = checkout();
    symlinkSync("../../README.md", join(root, "skills/askboard-help/link.md"));
    await refused(root, /skills\/askboard-help\/link\.md.*symbolic link/);
    await refused(
      checkout({ without: ["skills/askboard-help"] }),
      /skills\/askboard-help is missing/,
    );
  });

  test("a linked input file", () => {
    const root = checkout({ without: ["dist/askboard.mjs"] });
    symlinkSync(join(root, "README.md"), join(root, "dist/askboard.mjs"));
    return refused(root, /dist\/askboard\.mjs.*symbolic link/);
  });

  test("a manifest, a lockfile or a hidden file in a copied folder, or a bin or agents folder", async () => {
    for (const [path, what] of [
      ["skills/askboard/package.json", /skills\/askboard\/package\.json/],
      ["dist/view/bun.lock", /dist\/view\/bun\.lock/],
      ["dist/view/CLAUDE.md", /dist\/view\/CLAUDE\.md/],
      ["dist/view/.DS_Store", /dist\/view\/\.DS_Store/],
      ["dist/view/bin/tool", /dist\/view\/bin\/tool/],
      ["skills/askboard/agents/a.md", /skills\/askboard\/agents\/a\.md/],
    ] as const) {
      const root = checkout();
      write(root, path, "x\n");
      await refused(root, what);
    }
  });

  test("a non-empty output folder, and an output that is a file", async () => {
    const full = temporary("askboard-assemble-full-");
    writeFileSync(join(full, "keep.txt"), "kept\n");
    await expect(assemble(checkout(), full, ports)).rejects.toThrow(/not empty/);
    expect(readdirSync(full)).toEqual(["keep.txt"]);
    const file = join(temporary("askboard-assemble-file-"), "out");
    writeFileSync(file, "x");
    await expect(assemble(checkout(), file, ports)).rejects.toThrow(/not a folder/);
  });

  test("versions that disagree, naming the file and both versions", async () => {
    const root = checkout({ versionOf: { "packages/a/package.json": "0.2.0" } });
    const failure = assemble(root, target(), ports);
    await expect(failure).rejects.toThrow(/packages\/a\/package\.json/);
    await expect(failure).rejects.toThrow(/0\.2\.0/);
    await expect(failure).rejects.toThrow(/0\.1\.0/);
  });

  test("a LICENSE with no copyright holder", async () => {
    const root = checkout();
    write(root, "LICENSE", "MIT License\n");
    await refused(root, /LICENSE.*copyright holder/);
  });

  test("a plugin manifest with no description", async () => {
    const root = checkout();
    write(root, ".claude-plugin/plugin.json", '{"name":"askboard","version":"0.1.0"}\n');
    await refused(root, /plugin\.json.*description/);
  });

  test("notices that cannot be written, such as a package with no licence text", async () => {
    const out = target();
    const failing = {
      notices: async () => Promise.reject(new Error("bare 1.0.0 has no licence file")),
    };
    await expect(assemble(checkout(), out, failing)).rejects.toThrow(
      "bare 1.0.0 has no licence file",
    );
    expect(existsSync(out)).toBe(false);
  });
});

describe("a copy that fails half way", () => {
  const unreadable = () => {
    const root = checkout();
    chmodSync(join(root, "README.md"), 0o000);
    return root;
  };

  test("removes the folder it created", async () => {
    const out = target();
    await expect(assemble(unreadable(), out, ports)).rejects.toThrow();
    expect(existsSync(out)).toBe(false);
  });

  test("empties the folder it was given", async () => {
    const out = temporary("askboard-assemble-given-");
    await expect(assemble(unreadable(), out, ports)).rejects.toThrow();
    expect(readdirSync(out)).toEqual([]);
  });
});

describe("main", () => {
  const run = async (root: string, args: string[]) => {
    const lines: string[] = [];
    const code = await main(root, args, (line) => lines.push(line), ports);
    return { code, lines };
  };

  test("--out writes the tree and says how many files", async () => {
    const out = target();
    const { code, lines } = await run(checkout(), ["--out", out]);
    expect(code).toBe(0);
    expect(lines.join("\n")).toContain("18 files");
    expect(existsSync(join(out, ".claude-plugin/marketplace.json"))).toBe(true);
  });

  test("--root names another checkout", async () => {
    const out = target();
    const { code } = await run(temporary("askboard-assemble-unused-"), [
      "--root",
      checkout(),
      "--out",
      out,
    ]);
    expect(code).toBe(0);
    expect(existsSync(join(out, "README.md"))).toBe(true);
  });

  test("a failure is reported and exits 1", async () => {
    const out = target();
    const { code, lines } = await run(checkout({ without: ["dist/askboard.mjs"] }), ["--out", out]);
    expect(code).toBe(1);
    expect(lines.join("\n")).toContain("dist/askboard.mjs");
    expect(existsSync(out)).toBe(false);
  });

  test("no --out, a repeated flag or another flag is a usage error", async () => {
    const root = checkout();
    for (const args of [[], ["--out"], ["--out", "a", "b"], ["--root", "x"], ["--other", "x"]]) {
      expect((await run(root, args)).code).toBe(2);
    }
  });
});
