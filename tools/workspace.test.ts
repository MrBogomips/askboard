import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

// The workspace layout of design decision 2, from the spine's layer table.
const PACKAGES = [
  "bench",
  "compute",
  "contract",
  "core",
  "hooks",
  "mod",
  "molecules",
  "server",
  "view",
  "widgets",
];
const SERVER_UNITS = [
  "board-host",
  "excerpts",
  "mcp-tools",
  "molecule-source",
  "notifier",
  "snapshot",
];
// Exact versions only (spine, Consistency Conventions); workspace links between packages.
const PINNED = /^(\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?|workspace:\*)$/;
const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

const root = join(import.meta.dir, "..");
const packageDir = (name: string) => join(root, "packages", name);
const readJson = (path: string) => Bun.file(path).json();
const subdirectories = (path: string) =>
  readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => entry.name)
    .sort();

describe("workspace layout", () => {
  test("packages/ holds exactly the ten packages", () => {
    expect(subdirectories(join(root, "packages"))).toEqual(PACKAGES);
  });

  test.each(PACKAGES)(
    "%s is a private ESM package at 0.0.0 with its entry and type configuration",
    async (name) => {
      const manifest = await readJson(join(packageDir(name), "package.json"));
      expect(manifest).toMatchObject({
        name: `@askboard/${name}`,
        version: "0.0.0",
        private: true,
        type: "module",
      });
      expect(manifest.exports["."]).toBe("./src/index.ts");
      for (const target of Object.values<string>(manifest.exports)) {
        expect(existsSync(join(packageDir(name), target))).toBe(true);
      }
      expect(existsSync(join(packageDir(name), "tsconfig.json"))).toBe(true);
    },
  );

  test("view exports ./assemble and ./catalog besides its root entry", async () => {
    const manifest = await readJson(join(packageDir("view"), "package.json"));
    expect(Object.keys(manifest.exports).sort()).toEqual([".", "./assemble", "./catalog"]);
  });

  test("server holds the six server unit folders", () => {
    expect(subdirectories(join(packageDir("server"), "src"))).toEqual(SERVER_UNITS);
  });

  test("every dependency is pinned exactly", async () => {
    const manifests = [
      "package.json",
      ...PACKAGES.map((name) => join("packages", name, "package.json")),
    ];
    for (const path of manifests) {
      const manifest = await readJson(join(root, path));
      for (const field of DEPENDENCY_FIELDS) {
        for (const [dependency, version] of Object.entries<string>(manifest[field] ?? {})) {
          expect({ path, dependency, version }).toEqual({
            path,
            dependency,
            version: expect.stringMatching(PINNED),
          });
        }
      }
    }
  });
});
