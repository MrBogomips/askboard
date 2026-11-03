import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildMod,
  MOD_OUT,
  main,
  modInputProblems,
  modOutputProblems,
  modValidatorsCode,
} from "./mod.ts";
import { modBindingProblems } from "./mod-bindings.ts";
import { ROOT } from "./paths.ts";

// The mod build (task 7.6; packaging spec, "The mod module"; design decision 7): one ESM file with
// no import, require or import.meta, exporting `register(on)`, its validators standalone. The built
// module is loaded as the conformance suite's stand-in mod host will load it: imported, given an
// `on` that records registrations, and driven with a fake `$`.

// The probe loads the built code in a process of its own, which keeps it out of this run's coverage.
const PROBE = join(ROOT, "packages/mod/test/built-module-probe.ts");

type Probe = {
  readonly exports: readonly string[];
  readonly events: readonly string[];
  readonly validBand: readonly string[] | undefined;
  readonly reachedAtRegister: number;
  readonly validSubmits: number;
  readonly validPaths: readonly string[];
  readonly otherSubmits: number;
  readonly requestsWithOtherFormat: number;
  readonly checks: readonly { what: string; generated: boolean; contract: boolean }[];
};

let dir = "";
let code = "";
let probe: Probe | undefined;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "askboard-mod-build-"));
  code = (await buildMod()).code;
  const module = join(dir, "askboard-mod.js");
  const validators = join(dir, "validators.mjs");
  await Bun.write(module, code);
  await Bun.write(validators, modValidatorsCode());
  const ran = Bun.spawnSync([process.execPath, PROBE, module, validators], { cwd: ROOT });
  if (ran.exitCode !== 0) throw new Error(ran.stderr.toString());
  probe = JSON.parse(ran.stdout.toString()) as Probe;
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("the mod's standalone validators", () => {
  test("need nothing at run time but Ajv's helpers, and hold no eval", () => {
    const source = modValidatorsCode();
    const required = [...source.matchAll(/require\(\s*"([^"]+)"\s*\)/g)].map((match) => match[1]);
    expect(required.length).toBeGreaterThan(0);
    expect(required.every((path) => /\/ajv\/dist\/runtime\/[a-z0-9]+\.js$/.test(path ?? ""))).toBe(
      true,
    );
    expect(source).not.toMatch(/\beval\s*\(|\bnew\s+Function\b|\bFunction\s*\(/);
  });

  test("agree with the mod's checks, which run the contract's, on each case", () => {
    expect(probe?.checks.length).toBeGreaterThan(0);
    for (const { what, generated, contract } of probe?.checks ?? []) {
      expect({ what, generated }).toEqual({ what, generated: contract });
    }
    expect(probe?.checks.filter((check) => check.contract).length).toBe(4);
  });
});

describe("the build's checks on the module", () => {
  test.each([
    ['import x from "y";\nexport {};', "an import statement"],
    ['const a = 1; import { b } from "c";', "an import statement"],
    ['await import("x");', "a dynamic import"],
    ["const u = import.meta.url;", "import.meta"],
    ['const fs = require("fs");', "require"],
    ['if (typeof require !== "undefined") {}', "require"],
  ])("refuse %j", (source, what) => {
    expect(modOutputProblems(source)).toEqual([
      `the mod holds ${what}, which the mod environment cannot load`,
    ]);
  });

  test("pass a bundled CommonJS helper and a word that only contains import", () => {
    expect(modOutputProblems("var require_x = f(); const important = require_x();")).toEqual([]);
  });

  test("refuse an input that would compile schemas, and keep Ajv's run-time helpers", () => {
    expect(
      modInputProblems([
        "node_modules/.bun/ajv@8.20.0/node_modules/ajv/dist/runtime/ucs2length.js",
        "node_modules/.bun/ajv@8.20.0/node_modules/ajv/dist/2020.js",
        "packages/contract/src/validate.ts",
        "packages/mod/src/push.ts",
      ]),
    ).toEqual([
      "the mod bundles node_modules/.bun/ajv@8.20.0/node_modules/ajv/dist/2020.js, which compiles schemas at run time",
      "the mod bundles packages/contract/src/validate.ts, which compiles schemas at run time",
    ]);
  });
});

describe("the built module", () => {
  test("holds no import, require or import.meta, and opens with its licence notices", () => {
    expect(modOutputProblems(code)).toEqual([]);
    expect(code).toStartWith("/*\nAskBoard's mod (hooks/askboard-mod.js)");
    expect(code).toContain("ajv 8.20.0 (MIT)");
    expect(code).not.toContain("packages/contract/src/validate.ts");
  });

  test("binds its top-level functions with const, and passes $ only to them (task 13.3)", () => {
    expect(modBindingProblems(code)).toEqual([]);
    // The review's case: Bun writes this helper as `var start = async (memory, $) =>`.
    expect(code).toMatch(/^const start = async \(memory, \$\) =>/m);
    expect(code).not.toMatch(/^var start\b/m);
  });

  test("exports register alone, which registers the session's start, the turns and the band", () => {
    expect(probe?.exports).toEqual(["register"]);
    expect(probe?.events).toEqual([
      "session.start",
      "turn.complete",
      "turn.start",
      "turn.step",
      "ui.render",
    ]);
    expect(probe?.reachedAtRegister).toBe(0);
  });

  test("draws a poll's pending ask in the band above the prompt (tasks 15.1 and 15.4)", () => {
    expect(probe?.validBand).toEqual([
      "🙋 AskBoard · 1 pending",
      expect.stringMatching(
        /^🙋 AskBoard › \[Which database should the orders service use\?\]\(http/,
      ),
      "<beneath>",
    ]);
  });

  test("pushes a valid poll's answer, with its standalone checks", () => {
    expect(probe?.validSubmits).toBe(1);
    expect(probe?.validPaths).toEqual([
      "POST /v1/mod/hello",
      "GET /v1/mod/poll",
      "POST /v1/mod/delivered",
    ]);
  });

  test("pushes nothing from a poll of another major, nor with a session file of another", () => {
    expect(probe?.otherSubmits).toBe(0);
    expect(probe?.requestsWithOtherFormat).toBe(0);
  });
});

describe("the command", () => {
  test("writes the module where --out says", async () => {
    const out = join(dir, "out", "askboard-mod.js");
    const lines: string[] = [];
    expect(await main(["--out", out], (line) => lines.push(line))).toBe(0);
    expect(await Bun.file(out).text()).toBe(code);
    expect(lines).toEqual([
      expect.stringMatching(/^build:mod: wrote .*askboard-mod\.js \(\d+ bytes\)/),
    ]);
  });

  test("refuses another argument", async () => {
    const lines: string[] = [];
    expect(await main(["--into", "x"], (line) => lines.push(line))).toBe(2);
    expect(lines).toEqual(["usage: bun tools/build/mod.ts [--out <file>]"]);
  });

  test("builds into hooks/, beside hooks.json, which names the module, and git ignores it", async () => {
    expect(MOD_OUT).toBe(join(ROOT, "hooks", "askboard-mod.js"));
    const hooks = await Bun.file(join(ROOT, "hooks", "hooks.json")).json();
    expect(hooks.modules).toEqual(["./askboard-mod.js"]);
    const ignored = Bun.spawnSync(["git", "check-ignore", "-q", MOD_OUT], { cwd: ROOT });
    expect(ignored.exitCode).toBe(0);
  });

  test("is part of bun run build", async () => {
    const { scripts } = await Bun.file(join(ROOT, "package.json")).json();
    expect(scripts["build:mod"]).toBe("bun tools/build/mod.ts");
    expect(scripts.build).toContain("bun run build:mod");
  });
});
