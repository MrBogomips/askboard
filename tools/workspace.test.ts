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
const readConfig = async (path: string) =>
  Bun.JSONC.parse(await Bun.file(join(root, path)).text()) as {
    compilerOptions?: Record<string, unknown>;
  };
const manifestPaths = [
  "package.json",
  ...PACKAGES.map((name) => join("packages", name, "package.json")),
];
const configPaths = [
  "tsconfig.base.json",
  "tsconfig.test.json",
  ...PACKAGES.map((name) => join("packages", name, "tsconfig.json")),
];
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
    for (const path of manifestPaths) {
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

  // Design decision 8: Dependabot ignores @types/bun, which is bumped by hand with the Bun pin.
  test("@types/bun has the version of the Bun pin in packageManager", async () => {
    const { packageManager, devDependencies } = await readJson(join(root, "package.json"));
    expect(packageManager).toMatch(/^bun@\d/);
    expect(devDependencies["@types/bun"]).toBe(packageManager.slice("bun@".length));
  });

  test("every package that declares @types/bun has the version of the Bun pin", async () => {
    const { packageManager } = await readJson(join(root, "package.json"));
    const pin = packageManager.slice("bun@".length);
    for (const path of manifestPaths) {
      const manifest = await readJson(join(root, path));
      for (const field of DEPENDENCY_FIELDS) {
        const version = manifest[field]?.["@types/bun"];
        if (version !== undefined)
          expect({ path, field, version }).toEqual({ path, field, version: pin });
      }
    }
  });

  // The import check resolves only @askboard/* and relative specifiers, so nothing may alias them.
  test("no configuration aliases imports", async () => {
    for (const path of configPaths) {
      const { paths, baseUrl, rootDirs } = (await readConfig(path)).compilerOptions ?? {};
      expect({ path, paths, baseUrl, rootDirs }).toEqual({
        path,
        paths: undefined,
        baseUrl: undefined,
        rootDirs: undefined,
      });
    }
    for (const path of manifestPaths) {
      const { imports } = await readJson(join(root, path));
      expect({ path, imports }).toEqual({ path, imports: undefined });
    }
  });

  // Design decision 3 and AD-1: no DOM, Node or Bun types in core and compute; nor in mod, which
  // reaches the machine only through the mod API (push delivery, design decision 7). Each states
  // its libraries and types itself, so a change to the base configuration cannot add any.
  test.each(["core", "compute", "mod"])(
    "%s compiles with ECMAScript libraries and no types",
    async (name) => {
      const own = (await readConfig(join("packages", name, "tsconfig.json"))).compilerOptions ?? {};
      const lib = own.lib as string[] | undefined;
      expect(lib).toBeArray();
      expect((lib ?? []).every((entry) => /^es/i.test(entry))).toBe(true);
      expect(own.types).toEqual([]);
    },
  );
});
