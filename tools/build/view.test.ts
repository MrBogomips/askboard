import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { VIEW_MANIFEST_FILE, type ViewManifest } from "@askboard/contract";
import { validateViewManifest } from "@askboard/contract/validate";
import { bundleChunk } from "./chunks.ts";
import { hashProblems, listedFiles } from "./manifest.ts";
import { SIZES_FILE } from "./paths.ts";
import { formatSizes, readSizes, sizeProblems } from "./sizes.ts";
import { main } from "./view.ts";

// One real build into a scratch folder, recording its sizes into a scratch file: the checks below
// read what `bun run build:view` writes to dist/view/.
let dir = "";
let out = "";
let sizesFile = "";
let manifest: ViewManifest;
const lines: string[] = [];
const text = (path: string) => Bun.file(join(out, path)).text();

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "askboard-view-build-"));
  out = join(dir, "view");
  sizesFile = join(dir, "chunk-sizes.json");
  const code = await main(["--out", out, "--sizes", sizesFile, "--record-sizes"], (line) =>
    lines.push(line),
  );
  if (code !== 0) throw new Error(`the view build failed:\n${lines.join("\n")}`);
  manifest = JSON.parse(await text(VIEW_MANIFEST_FILE));
}, 120_000);

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("bun run build:view (design decision 7)", () => {
  test("the manifest validates against the contract's view manifest schema", () => {
    const checked = validateViewManifest(manifest);
    expect(checked.ok ? [] : checked.problems).toEqual([]);
  });

  test("it lists the board page, the shell, the Choice component and their library chunks", () => {
    const kinds = Object.fromEntries(
      Object.entries(manifest.chunks).map(([name, chunk]) => [name, chunk.kind]),
    );
    expect(kinds).toEqual({
      choice: "component",
      "ext-apps": "library",
      radix: "library",
      react: "library",
      shell: "shell",
    });
    expect(manifest.chunks.choice?.components).toEqual(["choice"]);
    expect(manifest.chunks.shell?.needs).toEqual(["ext-apps", "react"]);
    expect(manifest.chunks.choice?.needs).toEqual(["radix", "react", "shell"]);
    expect(manifest.chunks.radix?.needs).toEqual(["react"]);
    expect(manifest.boardPage.html.path).toBe("board-page.html");
  });

  test("each hash matches its file, and the board page holds its script and styles inline", async () => {
    const files = Object.fromEntries(
      await Promise.all(
        listedFiles(manifest).map(async (path) => [path, await Bun.file(join(out, path)).bytes()]),
      ),
    );
    expect(hashProblems(manifest, (path) => files[path])).toEqual([]);
  });

  test("every chunk lists the licence notices of the code it holds", () => {
    const packages = (notices: ViewManifest["boardPage"]["licences"]) =>
      notices.map((notice) => notice.package);
    const { chunks, boardPage } = manifest;
    expect(packages(chunks.react?.licences ?? [])).toEqual([
      "@askboard/view",
      "react",
      "react-dom",
      "scheduler",
    ]);
    expect(packages(chunks.radix?.licences ?? [])).toContain("radix-ui");
    expect(packages(chunks.radix?.licences ?? [])).toContain("@radix-ui/react-radio-group");
    expect(packages(chunks["ext-apps"]?.licences ?? [])).toEqual(
      expect.arrayContaining([
        "@modelcontextprotocol/client",
        "@modelcontextprotocol/core",
        "@modelcontextprotocol/ext-apps",
        "zod",
      ]),
    );
    expect(packages(chunks.shell?.licences ?? [])).toContain("@askboard/view");
    expect(packages(chunks.choice?.licences ?? [])).toContain("@askboard/view");
    expect(packages(boardPage.licences)).toEqual(
      expect.arrayContaining(["@askboard/view", "@modelcontextprotocol/ext-apps", "ajv", "zod"]),
    );
    const all = [boardPage.licences, ...Object.values(chunks).map((chunk) => chunk.licences)];
    for (const notices of all) expect(notices.length).toBeGreaterThan(0);
  });

  test("each licence notice's file holds the package's licence text", async () => {
    const notice = manifest.chunks.react?.licences.find((entry) => entry.package === "react");
    expect(await text(notice?.path ?? "")).toContain("Permission is hereby granted");
    const own = manifest.chunks.shell?.licences.find((entry) => entry.package === "@askboard/view");
    expect(own?.licence).toBe("MIT");
    expect(await text(own?.path ?? "")).toContain("MIT License");
  });

  test("every chunk is a classic script without import.meta", async () => {
    const transpiler = new Bun.Transpiler({ loader: "js" });
    const scripts = [
      manifest.boardPage.script,
      ...Object.values(manifest.chunks).map((c) => c.script),
    ];
    for (const { path } of scripts) {
      const code = await text(path);
      expect(code).not.toMatch(/\bimport\s*\.\s*meta\b/);
      const { imports, exports } = transpiler.scan(code);
      expect({ path, imports, exports }).toEqual({ path, imports: [], exports: [] });
    }
  });

  test("the board page bundles its standalone validators and Ajv's run-time helper", async () => {
    const script = await text(manifest.boardPage.script.path);
    expect(script).toContain("ajv/dist/runtime/ucs2length");
    expect(script).toContain("must NOT have additional properties");
    expect(packagesIn(manifest.boardPage.licences)).toContain("ajv");
  });

  test("the styles carry DESIGN.md's tokens in both schemes, with the dark variant on .dark", async () => {
    const [shellStyles] = manifest.chunks.shell?.styles ?? [];
    const [pageStyles] = manifest.boardPage.styles;
    for (const file of [shellStyles, pageStyles]) {
      const css = await text(file?.path ?? "");
      expect(css).toContain("--background:#f7f5f0");
      expect(css).toContain("--background:#1b1916");
    }
    const [choiceStyles] = manifest.chunks.choice?.styles ?? [];
    expect(await text(choiceStyles?.path ?? "")).toContain("var(--");
  });

  test("the recorded sizes are the build's, and packages/view/chunk-sizes.json is up to date", async () => {
    const recorded = await readSizes(sizesFile);
    expect(Object.keys(recorded).sort()).toEqual([
      "board-page",
      "choice",
      "ext-apps",
      "radix",
      "react",
      "shell",
    ]);
    expect(sizeProblems(await readSizes(SIZES_FILE), recorded)).toEqual([]);
  });

  test("a build within the recorded sizes passes", async () => {
    const logged: string[] = [];
    expect(await main(["--out", out, "--sizes", sizesFile], (line) => logged.push(line))).toBe(0);
    expect(logged.at(-1)).toContain("build:view: wrote");
  }, 60_000);

  test("a chunk that outgrows its recorded size fails the build, naming it and both sizes", async () => {
    const built = await readSizes(sizesFile);
    const shell = built.shell ?? 0;
    const halved = join(dir, "halved-sizes.json");
    await Bun.write(halved, formatSizes({ ...built, shell: Math.floor(shell / 2) }));
    const logged: string[] = [];
    expect(await main(["--out", out, "--sizes", halved], (line) => logged.push(line))).toBe(1);
    const problems = logged.filter((line) => line.includes("recorded"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"shell"');
    expect(problems[0]).toContain(`${shell.toLocaleString("en-US")} bytes`);
    expect(problems[0]).toContain(`${Math.floor(shell / 2).toLocaleString("en-US")} bytes`);
  }, 60_000);
});

const packagesIn = (notices: ViewManifest["boardPage"]["licences"]) =>
  notices.map((notice) => notice.package);

describe("build failures", () => {
  test("a chunk holding import.meta fails the build, naming the chunk", async () => {
    const entry = join(dir, "meta.ts");
    await Bun.write(entry, "console.log(import.meta.url);\n");
    await expect(bundleChunk({ name: "probe", entry })).rejects.toThrow('"probe"');
  });

  test("an entry that does not build fails, naming the chunk", async () => {
    const entry = join(dir, "broken.ts");
    await Bun.write(entry, 'import { nothing } from "./nowhere.ts";\nconsole.log(nothing);\n');
    await expect(bundleChunk({ name: "broken", entry })).rejects.toThrow('"broken"');
  });

  test("a folder that holds something other than a view build is not replaced", async () => {
    const other = join(dir, "other");
    await Bun.write(join(other, "keep.txt"), "mine\n");
    const logged: string[] = [];
    expect(await main(["--out", other], (line) => logged.push(line))).toBe(1);
    expect(logged.join("\n")).toContain("holds no view build");
    expect(await Bun.file(join(other, "keep.txt")).text()).toBe("mine\n");
  });

  test("an unknown option fails with the usage", async () => {
    const logged: string[] = [];
    expect(await main(["--bogus"], (line) => logged.push(line))).toBe(1);
    expect(logged.join("\n")).toContain("--record-sizes");
  });
});
