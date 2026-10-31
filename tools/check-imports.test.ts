import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkImports, checkSource, formatViolation, main } from "./check-imports.ts";

const SERVER_UNITS = [
  "mcp-tools",
  "board-host",
  "excerpts",
  "molecule-source",
  "snapshot",
  "notifier",
];
const fileOf = (unit: string): string =>
  SERVER_UNITS.includes(unit)
    ? `packages/server/src/${unit}/index.ts`
    : `packages/${unit}/src/index.ts`;
const importOf = (specifier: string): string =>
  `import { x } from "${specifier}";\nexport { x };\n`;

// Each allowed edge of design decision 6, as [importing unit, specifier].
const ALLOWED: [string, string][] = [
  ["compute", "@askboard/contract"],
  ["core", "@askboard/contract"],
  ["core", "@askboard/compute"],
  ...SERVER_UNITS.flatMap((unit): [string, string][] => [
    [unit, "@askboard/core"],
    [unit, "@askboard/contract"],
  ]),
  ["molecule-source", "@askboard/molecules"],
  ["snapshot", "@askboard/view/assemble"],
  ["molecules", "@askboard/contract"],
  ["view", "@askboard/contract"],
  ["view", "@askboard/compute"],
  ["widgets", "@askboard/contract"],
  ["widgets", "@askboard/compute"],
  ["widgets", "@askboard/view/catalog"],
  ["mod", "@askboard/contract"],
  ["hooks", "@askboard/contract"],
  ["bench", "@askboard/contract"],
];

// Disallowed edges, as [importing unit, specifier].
const DISALLOWED: [string, string][] = [
  ["contract", "@askboard/core"],
  ["contract", "@askboard/compute"],
  ["compute", "@askboard/core"],
  ["core", "@askboard/server"],
  ["core", "@askboard/view"],
  ["core", "@askboard/molecules"],
  ["mcp-tools", "@askboard/server"],
  ["mcp-tools", "@askboard/compute"],
  ["board-host", "@askboard/view/assemble"],
  ["mcp-tools", "@askboard/view/assemble"],
  ["notifier", "@askboard/molecules"],
  ["snapshot", "@askboard/view"],
  ["snapshot", "@askboard/view/catalog"],
  ["molecules", "@askboard/core"],
  ["view", "@askboard/core"],
  ["view", "@askboard/widgets"],
  ["widgets", "@askboard/view"],
  ["widgets", "@askboard/view/assemble"],
  ["widgets", "@askboard/core"],
  ["mod", "@askboard/core"],
  ["mod", "@askboard/server"],
  ["hooks", "@askboard/server"],
  ["bench", "@askboard/server"],
  ["bench", "@askboard/compute"],
  ["core", "@askboard/unknown"],
];

describe("unit boundaries (AD-1)", () => {
  test.each(ALLOWED)("%s may import %s", (unit, specifier) => {
    expect(checkSource(fileOf(unit), importOf(specifier))).toEqual([]);
  });

  test.each(DISALLOWED)("%s may not import %s", (unit, specifier) => {
    const violations = checkSource(fileOf(unit), importOf(specifier));
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: fileOf(unit), specifier });
  });

  test("a unit may import its own files and package", () => {
    expect(checkSource("packages/core/src/a.ts", importOf("./b.ts"))).toEqual([]);
    expect(checkSource("packages/view/src/shell.ts", importOf("./assemble/index.ts"))).toEqual([]);
    expect(checkSource("packages/view/src/shell.ts", importOf("@askboard/view/catalog"))).toEqual(
      [],
    );
    expect(checkSource("packages/server/src/board-host/a.ts", importOf("./listener/b.ts"))).toEqual(
      [],
    );
  });

  test("a server unit may not import another server unit by a relative path", () => {
    const violations = checkSource(
      "packages/server/src/mcp-tools/tools.ts",
      importOf("../board-host/index.ts"),
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toContain("never another server unit");
  });

  test.each([
    ["packages/core/src/a.ts", "../../contract/src/index.ts", "contract"],
    ["packages/server/src/snapshot/a.ts", "../../../view/src/assemble/index.ts", "view/assemble"],
    ["packages/widgets/src/a.ts", "../../view/src/catalog/internal/x.ts", "view/catalog"],
    ["packages/core/test/a.test.ts", "../../compute/src/index.ts", "compute"],
  ])("%s may not reach an allowed unit by the relative path %s", (file, specifier, unit) => {
    const violations = checkSource(file, importOf(specifier));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.target).toBe(unit);
    expect(violations[0]?.rule).toContain(`import @askboard/${unit}`);
  });

  test("a relative path into a unit the rules forbid breaks the unit rule", () => {
    const notifier = checkSource(
      "packages/core/src/a.ts",
      importOf("../../server/src/notifier/index.ts"),
    );
    expect(notifier.map((violation) => violation.rule)).toEqual([
      expect.stringContaining("core may import only contract, compute"),
    ]);
    const assemble = checkSource(
      "packages/widgets/src/a.ts",
      importOf("../../view/src/assemble/index.ts"),
    );
    expect(assemble.map((violation) => violation.rule)).toEqual([
      expect.stringContaining("widgets may import only"),
    ]);
  });

  test("relative paths inside the importing package pass", () => {
    expect(checkSource("packages/core/src/a.ts", importOf("./b.ts"))).toEqual([]);
    expect(checkSource("packages/core/test/a.test.ts", importOf("../src/index.ts"))).toEqual([]);
    expect(checkSource("packages/core/src/a.ts", importOf("../../core/src/b.ts"))).toEqual([]);
    expect(checkSource("packages/view/src/assemble/a.ts", importOf("../catalog/index.ts"))).toEqual(
      [],
    );
    expect(checkSource("packages/server/src/snapshot/a.ts", importOf("./b/c.ts"))).toEqual([]);
    expect(checkSource("packages/server/src/snapshot/a.ts", importOf("../snapshot/b.ts"))).toEqual(
      [],
    );
  });

  test("a relative path that leaves packages/ fails", () => {
    const violations = checkSource("packages/core/src/a.ts", importOf("../../../tools/x.ts"));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toContain("outside packages/");
  });

  test.each([
    "/repo/packages/core/src/index.ts",
    "file:///repo/packages/core/src/index.ts",
    "#core",
  ])("%s, which the check cannot resolve to a unit, fails", (specifier) => {
    const violations = checkSource("packages/contract/src/a.ts", importOf(specifier));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toContain("cannot resolve");
  });

  // The isolated linker links each declared @askboard/* dependency into the package's own
  // node_modules, so such a path leaves the package although its text stays inside it.
  test.each([
    ["packages/widgets/src/a.ts", "../node_modules/@askboard/view/src/assemble/x.ts"],
    ["packages/widgets/src/a.ts", "../node_modules/@askboard/view/src/catalog/x.ts"],
    ["packages/core/src/a.ts", "./node_modules/x.ts"],
  ])("%s may not import %s through node_modules", (file, specifier) => {
    const violations = checkSource(file, importOf(specifier));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toContain("node_modules");
  });

  // Design decision 9 (AD-1 as amended by E1): the session process entry point, the files of
  // packages/server/src outside the six unit folders, composes the units, and nothing imports it.
  test.each([
    "@askboard/core",
    "@askboard/contract",
    "@askboard/contract/validate",
    ...SERVER_UNITS.map((unit) => `./${unit}/index.ts`),
    "./identity.ts",
  ])("the session process entry point may import %s", (specifier) => {
    expect(checkSource("packages/server/src/main.ts", importOf(specifier))).toEqual([]);
  });

  test.each([
    "@askboard/compute",
    "@askboard/view",
    "@askboard/view/assemble",
    "@askboard/widgets",
    "@askboard/molecules",
    "@askboard/mod",
  ])("the session process entry point may not import %s", (specifier) => {
    const violations = checkSource("packages/server/src/main.ts", importOf(specifier));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toContain("entry point");
  });

  test.each([
    ...SERVER_UNITS.flatMap((unit): [string, string][] => [
      [`packages/server/src/${unit}/index.ts`, "../main.ts"],
      [`packages/server/src/${unit}/index.ts`, "../identity.ts"],
      [`packages/server/src/${unit}/index.ts`, "@askboard/server"],
    ]),
    ["packages/core/src/index.ts", "@askboard/server"],
    ["packages/core/src/index.ts", "../../server/src/main.ts"],
    ["packages/view/src/index.ts", "@askboard/server"],
  ])("%s may not import the entry point as %s", (file, specifier) => {
    expect(checkSource(file, importOf(specifier))).toHaveLength(1);
  });

  test("third-party packages are outside the unit rules", () => {
    expect(checkSource("packages/view/src/a.ts", importOf("react"))).toEqual([]);
    expect(checkSource("packages/core/src/a.ts", importOf("@scope/lib/sub"))).toEqual([]);
  });

  test("the rule names the importing unit and what it may import", () => {
    const [violation] = checkSource(fileOf("widgets"), importOf("@askboard/view"));
    expect(violation?.rule).toContain("widgets may import only contract, compute, view/catalog");
    expect(violation?.rule).toContain("AD-1");
  });
});

describe("runtime-specific imports in core and compute (AD-1)", () => {
  const BUILT_INS = ["node:fs", "fs", "fs/promises", "path", "bun", "bun:sqlite", "bun:test"];

  test.each(["core", "compute"])("%s sources may not import Node or Bun built-ins", (unit) => {
    for (const specifier of BUILT_INS) {
      const violations = checkSource(`packages/${unit}/src/a.ts`, importOf(specifier));
      expect(violations).toHaveLength(1);
      expect(violations[0]?.rule).toContain("no Node-only or Bun-only API");
    }
  });

  test.each([
    "packages/core/src/a.test.ts",
    "packages/compute/src/graph/a.test.tsx",
    "packages/core/test/helpers.ts",
  ])("%s, a test file, may import them", (file) => {
    for (const specifier of BUILT_INS) {
      expect(checkSource(file, importOf(specifier))).toEqual([]);
    }
  });

  test("test files still keep to the unit boundaries", () => {
    expect(checkSource("packages/core/src/a.test.ts", importOf("@askboard/server"))).toHaveLength(
      1,
    );
  });

  test("other units may import built-ins", () => {
    expect(checkSource(fileOf("board-host"), importOf("node:http"))).toEqual([]);
    expect(checkSource(fileOf("bench"), importOf("bun"))).toEqual([]);
  });
});

describe("triple-slash references (AD-1)", () => {
  const reference = (kind: string, value: string) =>
    `/// <reference ${kind}="${value}" />\nexport {};\n`;

  test.each(["contract", "core", "compute"])(
    "%s sources may not reference type packages or non-ECMAScript libraries",
    (unit) => {
      for (const [kind, value] of [
        ["types", "bun"],
        ["types", "node"],
        ["lib", "dom"],
        ["lib", "webworker"],
      ]) {
        const violations = checkSource(
          `packages/${unit}/src/a.ts`,
          reference(kind ?? "", value ?? ""),
        );
        expect(violations).toHaveLength(1);
        expect(violations[0]?.rule).toContain("reference no type package");
      }
    },
  );

  test("ECMAScript libraries, test files and other units are allowed", () => {
    expect(checkSource("packages/core/src/a.ts", reference("lib", "es2024"))).toEqual([]);
    expect(checkSource("packages/core/src/a.ts", reference("lib", "esnext.disposable"))).toEqual(
      [],
    );
    expect(checkSource("packages/core/src/a.test.ts", reference("types", "bun"))).toEqual([]);
    expect(checkSource("packages/view/src/a.ts", reference("lib", "dom"))).toEqual([]);
    expect(checkSource(fileOf("board-host"), reference("types", "node"))).toEqual([]);
  });

  test("a path reference counts as an import", () => {
    const outside = checkSource(
      "packages/contract/src/a.ts",
      reference("path", "../../core/src/globals.d.ts"),
    );
    expect(outside.map((violation) => violation.target)).toEqual(["core"]);
    expect(checkSource("packages/core/src/a.ts", reference("path", "local.d.ts"))).toEqual([]);
    const allowed = checkSource(
      "packages/widgets/src/a.ts",
      reference("path", "../../view/src/catalog/x.d.ts"),
    );
    expect(allowed.map((violation) => violation.rule)).toEqual([
      expect.stringContaining("import @askboard/view/catalog"),
    ]);
  });

  test.each(["/repo/packages/core/src/x.d.ts", "file:///repo/packages/core/src/x.d.ts"])(
    "the absolute path reference %s fails",
    (path) => {
      const violations = checkSource("packages/core/src/a.ts", reference("path", path));
      expect(violations.map((violation) => violation.rule)).toEqual([
        expect.stringContaining("cannot resolve"),
      ]);
    },
  );
});

describe("import forms", () => {
  const FORMS: [string, string][] = [
    ["static import", 'import { x } from "@askboard/core";\nexport const y = x;'],
    ["side-effect import", 'import "@askboard/core";'],
    ["namespace import", 'import * as core from "@askboard/core";\nexport const y = core;'],
    ["re-export", 'export { x } from "@askboard/core";'],
    ["star re-export", 'export * from "@askboard/core";'],
    ["namespace re-export", 'export * as core from "@askboard/core";'],
    ["literal dynamic import", 'export const m = await import("@askboard/core");'],
    ["template dynamic import", "export const m = import(`@askboard/core`);"],
    ["require call", 'export const m = require("@askboard/core");'],
    ["import.meta.require call", 'export const m = import.meta.require("@askboard/core");'],
    ["type-only import", 'import type { X } from "@askboard/core";\nexport type Y = X;'],
    ["inline type import", 'import { type X } from "@askboard/core";\nexport type Y = X;'],
    ["unused import", 'import { x } from "@askboard/core";'],
    ["type-only re-export", 'export type { X } from "@askboard/core";'],
    ["type-only star re-export", 'export type * from "@askboard/core";'],
    ["import type query", 'export type Y = import("@askboard/core").X;'],
    [
      "type-only import with a comment",
      'import /* c */ type { X } from "@askboard/core";\nexport type Y = X;',
    ],
    [
      "inline type import with a comment",
      'import { /* c */ type X } from "@askboard/core";\nexport type Y = X;',
    ],
    ["unspaced type-only import", 'import type{X}from"@askboard/core";\nexport type Y = X;'],
    ["unspaced type-only re-export", 'export type{X}from"@askboard/core";'],
    [
      "import type query with attributes",
      'export type Y = import("@askboard/core", { with: { "resolution-mode": "import" } }).X;',
    ],
  ];

  test.each(FORMS)("a %s is seen", (_form, source) => {
    const violations = checkSource("packages/contract/src/a.ts", source);
    expect(violations.map((violation) => violation.specifier)).toEqual(["@askboard/core"]);
  });

  test("imports in a .tsx file are seen", () => {
    const source = 'import { x } from "@askboard/core";\nexport const E = () => <div>{x}</div>;';
    expect(checkSource("packages/widgets/src/a.tsx", source)).toHaveLength(1);
  });

  test("a default import named type, or starting with type, is a value import", () => {
    const source = 'import type from "@askboard/core";\nexport const y = type;';
    expect(checkSource("packages/contract/src/a.ts", source)).toHaveLength(1);
    const prefixed = 'import typeX from "@askboard/core";\nexport const y = typeX;';
    expect(checkSource("packages/contract/src/a.ts", prefixed)).toHaveLength(1);
  });

  test("specifiers in strings and line comments are not imports", () => {
    const source = [
      "const s = 'import { x } from \"@askboard/core\"';",
      '// import { y } from "@askboard/core";',
      "export { s };",
    ].join("\n");
    expect(checkSource("packages/contract/src/a.ts", source)).toEqual([]);
  });

  test("a non-literal dynamic import is not resolved", () => {
    const source = "const name = 'x';\nexport const m = import(name);";
    expect(checkSource("packages/contract/src/a.ts", source)).toEqual([]);
  });

  test("a file that does not parse fails", () => {
    const violations = checkSource("packages/core/src/a.ts", "import { from;");
    expect(violations).toHaveLength(1);
    expect(violations[0]?.rule).toContain("could not parse");
  });
});

describe("the tree and the command", () => {
  let root = "";
  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  };

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "check-imports-"));
    write("packages/contract/src/index.ts", "export {};\n");
    write("packages/core/src/index.ts", importOf("@askboard/contract"));
    write("packages/core/src/notes.md", importOf("@askboard/server"));
    write("packages/core/node_modules/dep/index.ts", importOf("@askboard/server"));
    write("packages/view/src/shell.tsx", "export const S = () => <div />;\n");
    write("packages/view/src/types.d.ts", "export type T = string;\n");
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  test("a clean tree passes, skipping node_modules and non-source files", async () => {
    const result = await checkImports(root);
    expect(result.violations).toEqual([]);
    expect(result.files).toBe(4);
  });

  test("main exits 0 on a clean tree and 1 on a violation", async () => {
    const lines: string[] = [];
    const log = (line: string) => lines.push(line);
    expect(await main([root], log)).toBe(0);
    expect(lines.join("\n")).toContain("4 files");

    write("packages/compute/src/index.ts", importOf("@askboard/core"));
    lines.length = 0;
    expect(await main([root], log)).toBe(1);
    expect(lines.join("\n")).toContain('packages/compute/src/index.ts: "@askboard/core"');
  });

  test("files in dot folders are checked; symbolic links fail", async () => {
    write("packages/core/src/.internal/a.ts", importOf("@askboard/server"));
    symlinkSync(
      join(root, "packages/contract/src/index.ts"),
      join(root, "packages/contract/src/link.ts"),
    );
    const { violations } = await checkImports(root);
    const files = violations.map((violation) => violation.file);
    expect(files).toContain("packages/core/src/.internal/a.ts");
    const link = violations.find((violation) => violation.file === "packages/contract/src/link.ts");
    expect(link?.rule).toContain("symbolic link");
  });

  test("a violation prints the file, the specifier and the rule", () => {
    const [violation] = checkSource("packages/mod/src/a.ts", importOf("@askboard/core"));
    expect(violation).toBeDefined();
    if (violation) {
      expect(formatViolation(violation)).toBe(
        `packages/mod/src/a.ts: "@askboard/core" (core): ${violation.rule}`,
      );
    }
  });
});
