import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VIEW_MANIFEST_FILE } from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import { validateViewManifest } from "@askboard/contract/validate";
import {
  assembledSrcdoc,
  EVAL_PROBE,
  fixtureViewBuild,
  readViewBuild,
  sha256Hex,
  THROWING_CHOICE_ERROR,
  type ViewBuild,
  withBoardPageProbe,
  withBreakingTextField,
  withChunkScript,
  withKeysProbe,
  withThrowingChoice,
  withViewProbe,
} from "./view-build.ts";

const build = fixtureViewBuild();
const shell = fixtureViewManifest.chunks.shell;
if (shell === undefined) throw new Error("the fixture manifest has no shell");

// Every file the manifest lists has the bytes and the digest it names.
const digestProblems = ({ manifest, files }: ViewBuild): string[] => {
  const listed = [
    manifest.boardPage.html,
    manifest.boardPage.script,
    ...manifest.boardPage.styles,
    ...Object.values(manifest.chunks).flatMap((chunk) => [chunk.script, ...chunk.styles]),
  ];
  return listed.flatMap((file) => {
    const text = files.get(file.path);
    if (text === undefined) return [`${file.path}: missing`];
    if (sha256Hex(text) !== file.sha256) return [`${file.path}: digest`];
    return Buffer.byteLength(text) === file.bytes ? [] : [`${file.path}: size`];
  });
};

describe("the fixture view build", () => {
  test("holds the contract's manifest and files, the manifest text as written", () => {
    expect(build.manifest).toEqual(fixtureViewManifest);
    expect(build.manifestText).toBe(fixtureViewFiles[VIEW_MANIFEST_FILE] ?? "");
    expect(digestProblems(build)).toEqual([]);
  });
});

describe("readViewBuild", () => {
  let dir = "";
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "askboard-harness-view-"));
    for (const [path, text] of Object.entries(fixtureViewFiles)) {
      await Bun.write(join(dir, path), text);
    }
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("reads the manifest and the files it serves from a build folder", async () => {
    const read = await readViewBuild(dir);
    expect(read.manifest).toEqual(fixtureViewManifest);
    expect(read.manifestText).toBe(fixtureViewFiles[VIEW_MANIFEST_FILE] ?? "");
    expect(digestProblems(read)).toEqual([]);
  });

  test("fails with the command that builds the view when the folder holds no build", async () => {
    await expect(readViewBuild(join(dir, "nowhere"))).rejects.toThrow("bun run build:view");
  });

  test("fails on a manifest the contract refuses, naming the problem", async () => {
    const bad = join(dir, "bad");
    await Bun.write(join(bad, VIEW_MANIFEST_FILE), JSON.stringify({ version: "1.0" }));
    await expect(readViewBuild(bad)).rejects.toThrow('missing field "boardPage"');
  });
});

describe("test-only variants", () => {
  test("a chunk with another script gets that script's digest and size, the rest unchanged", () => {
    const script = "(()=>{globalThis.replaced=true})();\n";
    const variant = withChunkScript(build, "shell", script);
    const chunk = variant.manifest.chunks.shell;
    expect(chunk?.script).toEqual({
      path: shell.script.path,
      sha256: sha256Hex(script),
      bytes: Buffer.byteLength(script),
    });
    expect(variant.files.get(shell.script.path)).toBe(script);
    expect(variant.manifest.chunks.react).toEqual(fixtureViewManifest.chunks.react);
    expect(JSON.parse(variant.manifestText)).toEqual(variant.manifest);
    expect(validateViewManifest(variant.manifest).ok).toBe(true);
    expect(digestProblems(variant)).toEqual([]);
    expect(build.manifest.chunks.shell).toEqual(shell);
  });

  test("an unknown chunk fails, naming it", () => {
    expect(() => withChunkScript(build, "table", "")).toThrow('"table"');
  });

  test("the view probe runs a caught eval and new Function before the shell's own code", () => {
    const variant = withViewProbe(build);
    const original = build.files.get(shell.script.path) ?? "";
    expect(variant.files.get(shell.script.path)).toBe(`${EVAL_PROBE}${original}`);
    expect(EVAL_PROBE).toContain("eval(");
    expect(EVAL_PROBE).toContain("new Function(");
    expect(digestProblems(variant)).toEqual([]);
  });

  test("the board page probe changes the script inline in the page and beside it", () => {
    const variant = withBoardPageProbe(build);
    const { html, script } = variant.manifest.boardPage;
    const probed = variant.files.get(script.path) ?? "";
    expect(probed.startsWith(EVAL_PROBE)).toBe(true);
    expect(variant.files.get(html.path)).toContain(`<script>${probed}</script>`);
    expect(digestProblems(variant)).toEqual([]);
    expect(validateViewManifest(variant.manifest).ok).toBe(true);
  });

  test("the throwing Choice is a classic script that registers through the shell's port", async () => {
    const variant = await withThrowingChoice(build);
    const script = variant.manifest.chunks.choice?.script;
    const text = variant.files.get(script?.path ?? "") ?? "";
    expect(text).toContain(THROWING_CHOICE_ERROR);
    expect(text).toContain("@askboard/view/catalog");
    expect(text).not.toContain("import.meta");
    expect(text).not.toMatch(/^\s*(import|export)\b/m);
    expect(digestProblems(variant)).toEqual([]);
  });

  test("the keys probe is a classic script that registers through the shell's port", async () => {
    // The fixture build holds no TextField chunk: give it one, a copy of the Choice chunk's script.
    const choice = build.manifest.chunks.choice;
    if (choice === undefined) throw new Error("the fixture manifest has no choice chunk");
    const path = "chunks/text-field.js";
    const withField: ViewBuild = {
      ...build,
      manifest: {
        ...build.manifest,
        chunks: {
          ...build.manifest.chunks,
          "text-field": { ...choice, script: { ...choice.script, path } },
        },
      },
      files: new Map([...build.files, [path, build.files.get(choice.script.path) ?? ""]]),
    };
    const variant = await withKeysProbe(withField);
    const script = variant.manifest.chunks["text-field"]?.script;
    const text = variant.files.get(script?.path ?? "") ?? "";
    expect(text).toContain("data-probe-item");
    expect(text).toContain("@askboard/view/catalog");
    expect(text).not.toContain("import.meta");
    expect(text).not.toMatch(/^\s*(import|export)\b/m);
    expect(digestProblems(variant)).toEqual([]);
  });

  test("the breaking TextField is a classic script that registers through the shell's port", async () => {
    // The fixture build holds no TextField chunk: give it one, a copy of the Choice chunk's script.
    const choice = build.manifest.chunks.choice;
    if (choice === undefined) throw new Error("the fixture manifest has no choice chunk");
    const path = "chunks/text-field.js";
    const withField: ViewBuild = {
      ...build,
      manifest: {
        ...build.manifest,
        chunks: {
          ...build.manifest.chunks,
          "text-field": { ...choice, script: { ...choice.script, path } },
        },
      },
      files: new Map([...build.files, [path, build.files.get(choice.script.path) ?? ""]]),
    };
    const variant = await withBreakingTextField(withField);
    const script = variant.manifest.chunks["text-field"]?.script;
    const text = variant.files.get(script?.path ?? "") ?? "";
    expect(text).toContain("broke after it counted as visible");
    expect(text).toContain("@askboard/view/catalog");
    expect(text).not.toContain("import.meta");
    expect(text).not.toMatch(/^\s*(import|export)\b/m);
    expect(digestProblems(variant)).toEqual([]);
  });

  test("a board page whose script is not inline exactly once fails", () => {
    const html = fixtureViewManifest.boardPage.html.path;
    const files = new Map(build.files);
    files.set(html, "<!doctype html><p>no script</p>");
    expect(() => withBoardPageProbe({ ...build, files })).toThrow("inline exactly once");
  });
});

describe("assembledSrcdoc", () => {
  test("is the view the board page would assemble: the policy, the data and the probed shell", () => {
    const variant = withViewProbe(build);
    const srcdoc = assembledSrcdoc(variant, plainChoiceBoardDocument);
    expect(srcdoc).toContain('<meta http-equiv="Content-Security-Policy"');
    expect(srcdoc).toContain('"state":{"ask":"waiting"');
    expect(srcdoc).toContain(`<script>${variant.files.get(shell.script.path)}</script>`);
  });
});
