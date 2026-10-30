import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VIEW_DIRECTORY, VIEW_MANIFEST_FILE } from "@askboard/contract";
import { DIST_BUNDLE, stageSession, writeViewBuild } from "./session-stage.ts";
import { fixtureViewBuild, readViewBuild, withViewProbe } from "./view-build.ts";

const view = fixtureViewBuild();

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

const scratch = async () => {
  const dir = await mkdtemp(join(tmpdir(), "askboard-stage-test-"));
  dirs.push(dir);
  return dir;
};

// A built checkout's `dist/`: the bundle with the view build beside it (design decision 7).
const dist = async (withView: boolean) => {
  const dir = await scratch();
  const bundle = join(dir, "askboard.mjs");
  await Bun.write(bundle, "// the session process\n");
  if (withView) await writeViewBuild(join(dir, VIEW_DIRECTORY), view);
  return bundle;
};

describe("writeViewBuild", () => {
  test("writes a build folder that reads back as the same build", async () => {
    const dir = join(await scratch(), VIEW_DIRECTORY);
    await writeViewBuild(dir, view);
    const back = await readViewBuild(dir);
    expect(back.manifestText).toBe(view.manifestText);
    expect(back.files.size).toBeGreaterThan(0);
    for (const [path, text] of back.files) expect(text).toBe(view.files.get(path) ?? "");
  });
});

describe("stageSession", () => {
  test("runs the bundle where it is when the view beside it is the scenario's", async () => {
    const bundle = await dist(true);
    const stage = await stageSession(view, bundle);
    expect(stage.entry).toBe(bundle);
    await stage.cleanup();
    expect(await Bun.file(bundle).exists()).toBe(true);
  });

  test("runs a copy of the bundle beside a test-only view, removed afterwards", async () => {
    const bundle = await dist(true);
    const probed = withViewProbe(view);
    const stage = await stageSession(probed, bundle);
    expect(stage.entry).not.toBe(bundle);
    expect(await Bun.file(stage.entry).text()).toBe("// the session process\n");
    const beside = join(stage.entry, "..", VIEW_DIRECTORY);
    expect(await Bun.file(join(beside, VIEW_MANIFEST_FILE)).text()).toBe(probed.manifestText);
    await stage.cleanup();
    expect(await Bun.file(stage.entry).exists()).toBe(false);
  });

  test("stages a copy when the bundle has no view beside it", async () => {
    const bundle = await dist(false);
    const stage = await stageSession(view, bundle);
    expect(stage.entry).not.toBe(bundle);
    await stage.cleanup();
  });

  test("fails without a bundle, saying how to build it", async () => {
    const dir = await scratch();
    await mkdir(join(dir, VIEW_DIRECTORY));
    await expect(stageSession(view, join(dir, "askboard.mjs"))).rejects.toThrow(
      "run `bun run build` first",
    );
    expect(DIST_BUNDLE).toEndWith("dist/askboard.mjs");
  });
});
