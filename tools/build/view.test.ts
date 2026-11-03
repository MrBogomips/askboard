import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type BoardState,
  cspHashSource,
  type ManifestChunk,
  VIEW_MANIFEST_FILE,
  type ViewManifest,
} from "@askboard/contract";
import {
  ganttBoardDocument,
  ganttPlanBoardDocument,
  plainChoiceBoardDocument,
  treeBoardDocument,
  uj2ExpandedBoardDocument,
} from "@askboard/contract/fixtures";
import { validateViewManifest } from "@askboard/contract/validate";
// `assemble` as the board page runs it, on this build; the root links no `@askboard/view`.
import { assemble, selectChunks, sourcesToFetch } from "../../packages/view/src/assemble/index.ts";
import { questionsOf, type ViewDocument } from "../../packages/view/src/view-document.ts";
import { bundleChunk } from "./chunks.ts";
import { hashProblems, listedFiles } from "./manifest.ts";
import { ROOT, SIZES_FILE } from "./paths.ts";
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
const chunkNamed = (name: string): ManifestChunk => {
  const chunk = Object.hasOwn(manifest.chunks, name) ? manifest.chunks[name] : undefined;
  if (chunk === undefined) throw new Error(`the build made no ${name} chunk`);
  return chunk;
};

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

  test("it lists the board page, the shell, the Choice and Tree components and their library chunks", () => {
    const kinds = Object.fromEntries(
      Object.entries(manifest.chunks).map(([name, chunk]) => [name, chunk.kind]),
    );
    expect(kinds).toEqual({
      "board-graph": "library",
      choice: "component",
      compute: "library",
      "ext-apps": "library",
      gantt: "component",
      radix: "library",
      react: "library",
      shell: "shell",
      tree: "component",
    });
    expect(manifest.chunks.choice?.components).toEqual(["choice"]);
    expect(manifest.chunks.tree?.components).toEqual(["tree"]);
    // Since the ask lifecycle the shell's tab strip is Radix Tabs (ask-lifecycle, task 6.2).
    expect(manifest.chunks.shell?.needs).toEqual(["ext-apps", "radix", "react"]);
    expect(manifest.chunks.choice?.needs).toEqual(["radix", "react", "shell"]);
    // The Tree reads the board graph since the molecules change (design decision 13).
    expect(manifest.chunks.tree?.needs).toEqual(["board-graph", "react", "shell"]);
    expect(manifest.chunks.radix?.needs).toEqual(["react"]);
    expect(manifest.boardPage.html.path).toBe("board-page.html");
  });

  test("it lists the Gantt's chunk, needing the shell, React, Radix, compute and the board graph, and compute's (gantt-widget design decisions 7 and 11)", () => {
    // Radix joined the Gantt's needs with its first Radix control, the predecessors' Checkbox.
    expect(chunkNamed("gantt").components).toEqual(["gantt"]);
    expect(chunkNamed("gantt").needs).toEqual([
      "board-graph",
      "compute",
      "radix",
      "react",
      "shell",
    ]);
    expect(chunkNamed("compute").needs).toEqual([]);
  });

  test("it lists the library chunk board-graph, needing compute, which the Tree and the Gantt need (molecules, design decision 13; view spec, The board graph chunk)", () => {
    expect(chunkNamed("board-graph").kind).toBe("library");
    expect(chunkNamed("board-graph").needs).toEqual(["compute"]);
    expect(chunkNamed("tree").needs).toContain("board-graph");
    expect(chunkNamed("gantt").needs).toContain("board-graph");
  });

  test("the board graph's code is in its chunk only, not in the Gantt's or the Tree's", async () => {
    // `missing` builds this detail for an address the live graph holds no node for.
    const marker = "no node ";
    expect(await text(chunkNamed("board-graph").script.path)).toContain(marker);
    expect(await text(chunkNamed("gantt").script.path)).not.toContain(marker);
    expect(await text(chunkNamed("tree").script.path)).not.toContain(marker);
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

  test("the Tree's chunk holds only AskBoard's own code, under the repository's MIT licence", async () => {
    // React and the port come from the react chunk and the shell (design decision 8); of `view`,
    // the chunk holds only the shared-module registry its imports of them read.
    const notices = chunkNamed("tree").licences;
    expect(packagesIn(notices)).toEqual([
      "@askboard/contract",
      "@askboard/view",
      "@askboard/widgets",
    ]);
    const repository = (await Bun.file(join(ROOT, "LICENSE")).text()).trimEnd();
    for (const notice of notices) {
      expect(notice.licence).toBe("MIT");
      expect((await text(notice.path)).trimEnd()).toBe(repository);
    }
  });

  test("the Tree's chunk holds no schema and no Ajv (design, Risks / Trade-offs)", async () => {
    // It checks its props with the contract's plain checks; the schemas stay with the validators.
    const script = await text(chunkNamed("tree").script.path);
    expect(script).toContain('"tree"');
    expect(script).not.toContain("urn:askboard");
    expect(script).not.toMatch(/\bajv\b/i);
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
      "board-graph",
      "board-page",
      "choice",
      "compute",
      "ext-apps",
      "gantt",
      "radix",
      "react",
      "shell",
      "tree",
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

// The board state with the document's question open, as the board page first shows it.
const openState = (document: ViewDocument): BoardState => {
  const [question] = questionsOf(document);
  if (question === undefined) throw new Error("the document holds no question");
  return {
    ask: "waiting",
    questions: [{ itemId: question.id, rev: question.rev, state: "open" }],
  };
};

// The srcdoc as the board page builds it: the selected chunks' files, fetched from the build.
const assembled = async (document: ViewDocument) => {
  const files = sourcesToFetch(selectChunks(document, manifest));
  const fetched = await Promise.all(
    files.map(async (file) => [file.sha256, await text(file.path)] as const),
  );
  return assemble({ document, state: openState(document) }, manifest, Object.fromEntries(fetched));
};

describe("only boards with a Tree load it (view spec, Widget chunks)", () => {
  test("the selection takes the tree chunk for a board holding a Tree, and not for the plain Choice board", () => {
    const names = (document: ViewDocument) =>
      selectChunks(document, manifest).map(({ name }) => name);
    // The shell needs the radix chunk since the ask lifecycle (Tabs, the "More" menu, the dialog).
    // Since the molecules change the Tree needs the board graph, and it compute (design decision 13).
    expect(names(treeBoardDocument)).toEqual([
      "compute",
      "board-graph",
      "ext-apps",
      "react",
      "radix",
      "shell",
      "tree",
    ]);
    expect(names(plainChoiceBoardDocument)).toContain("choice");
    expect(names(plainChoiceBoardDocument)).not.toContain("tree");
  });

  test("the plain Choice board's srcdoc holds no Tree chunk, and the Tree board's holds it", async () => {
    const { script } = chunkNamed("tree");
    const tree = await text(script.path);
    const withTree = await assembled(treeBoardDocument);
    const plain = await assembled(plainChoiceBoardDocument);
    expect(withTree.chunks).toContain("tree");
    expect(withTree.srcdoc).toContain(tree);
    expect(withTree.policy).toContain(cspHashSource(script.sha256));
    expect(plain.chunks).not.toContain("tree");
    expect(plain.srcdoc).not.toContain(tree);
    expect(plain.policy).not.toContain(cspHashSource(script.sha256));
  });
});

describe("the Gantt's chunks (gantt-widget design decisions 7 and 11; view spec, The Gantt's chunks)", () => {
  test("they hold only AskBoard's own code, under the repository's MIT licence", async () => {
    // React and the port come from the react chunk and the shell; of `view`, each holds only the
    // shared-module registry its imports, or its provision of compute, go through.
    expect(packagesIn(chunkNamed("gantt").licences)).toEqual([
      "@askboard/contract",
      "@askboard/view",
      "@askboard/widgets",
    ]);
    expect(packagesIn(chunkNamed("compute").licences)).toEqual([
      "@askboard/compute",
      "@askboard/contract",
      "@askboard/view",
    ]);
    const repository = (await Bun.file(join(ROOT, "LICENSE")).text()).trimEnd();
    for (const notice of [...chunkNamed("gantt").licences, ...chunkNamed("compute").licences]) {
      expect(notice.licence).toBe("MIT");
      expect((await text(notice.path)).trimEnd()).toBe(repository);
    }
  });

  test("they hold no schema, no Ajv and no code made from text, which the view's policy forbids", async () => {
    const gantt = await text(chunkNamed("gantt").script.path);
    const compute = await text(chunkNamed("compute").script.path);
    const graph = await text(chunkNamed("board-graph").script.path);
    expect(gantt).toContain('"gantt"');
    expect(compute).toContain('"@askboard/compute"');
    expect(graph).toContain('"@askboard/widgets/graph"');
    for (const script of [gantt, compute, graph]) {
      expect(script).not.toContain("urn:askboard");
      expect(script).not.toMatch(/\bajv\b/i);
      expect(script).not.toMatch(/\bnew Function\b|\beval\(/);
    }
  });

  test("the selection takes them for a board holding a Gantt, and not for the plain Choice board", () => {
    const names = (document: ViewDocument) =>
      selectChunks(document, manifest).map(({ name }) => name);
    // Each chunk after the chunks it needs: Radix after React.
    expect(names(ganttBoardDocument)).toEqual([
      "compute",
      "board-graph",
      "ext-apps",
      "react",
      "radix",
      "shell",
      "gantt",
    ]);
    expect(names(plainChoiceBoardDocument)).toContain("choice");
    expect(names(plainChoiceBoardDocument)).not.toContain("gantt");
    expect(names(plainChoiceBoardDocument)).not.toContain("compute");
    expect(names(plainChoiceBoardDocument)).not.toContain("board-graph");
  });

  test("the plan's board takes them with the Tree's chunk, and Radix carries the plan's zoom (design decision 10)", () => {
    const names = selectChunks(ganttPlanBoardDocument, manifest).map(({ name }) => name);
    expect(names).toEqual([
      "compute",
      "board-graph",
      "ext-apps",
      "react",
      "radix",
      "shell",
      "gantt",
      "tree",
    ]);
    // The zoom is a Radix Toggle Group, in the radix chunk with the toggle it is made of.
    expect(packagesIn(chunkNamed("radix").licences)).toEqual(
      expect.arrayContaining(["@radix-ui/react-toggle", "@radix-ui/react-toggle-group"]),
    );
  });

  test("the Gantt board's srcdoc inlines them, and the plain Choice board's none", async () => {
    const withGantt = await assembled(ganttBoardDocument);
    const plain = await assembled(plainChoiceBoardDocument);
    for (const name of ["gantt", "compute", "board-graph"]) {
      const { script } = chunkNamed(name);
      const code = await text(script.path);
      expect(withGantt.chunks).toContain(name);
      expect(withGantt.srcdoc).toContain(code);
      expect(withGantt.policy).toContain(cspHashSource(script.sha256));
      expect(plain.chunks).not.toContain(name);
      expect(plain.srcdoc).not.toContain(code);
      expect(plain.policy).not.toContain(cspHashSource(script.sha256));
    }
  });
});

describe("the board graph chunk (molecules, design decision 13; view spec, The board graph chunk)", () => {
  test("it holds only AskBoard's own code, under the repository's MIT licence", async () => {
    // compute and the port come from their chunks; of `view`, it holds only the registry.
    const notices = chunkNamed("board-graph").licences;
    expect(packagesIn(notices)).toEqual(["@askboard/view", "@askboard/widgets"]);
    const repository = (await Bun.file(join(ROOT, "LICENSE")).text()).trimEnd();
    for (const notice of notices) {
      expect(notice.licence).toBe("MIT");
      expect((await text(notice.path)).trimEnd()).toBe(repository);
    }
  });

  test("the UJ-2 work breakdown's srcdoc holds the board graph and compute once each, for the Tree and the plan both", async () => {
    const uj2 = await assembled(uj2ExpandedBoardDocument);
    expect(uj2.chunks).toEqual(expect.arrayContaining(["tree", "gantt", "board-graph", "compute"]));
    for (const name of ["board-graph", "compute"]) {
      const code = await text(chunkNamed(name).script.path);
      expect(uj2.srcdoc.split(code)).toHaveLength(2);
    }
  });

  test("the plain Choice board's srcdoc holds neither", async () => {
    const plain = await assembled(plainChoiceBoardDocument);
    for (const name of ["board-graph", "compute"]) {
      expect(plain.chunks).not.toContain(name);
      expect(plain.srcdoc).not.toContain(await text(chunkNamed(name).script.path));
    }
  });
});

describe("molecules reach the view expanded (molecules; view spec, Molecules reach the view expanded)", () => {
  test("no chunk of the build registers molecule, so a board holding a reference builds no srcdoc", async () => {
    const [question] = plainChoiceBoardDocument.items;
    const reference = {
      type: "molecule",
      id: "wbs",
      props: { molecule: "wbs-pert", version: "1.0.0", data: { nodes: [] } },
    };
    const document: ViewDocument = {
      ...plainChoiceBoardDocument,
      items: [{ ...question, props: { ...question.props, items: [reference] } }],
    };
    const components = Object.values(manifest.chunks).flatMap((chunk) => chunk.components ?? []);
    expect(components).not.toContain("molecule");
    await expect(assembled(document)).rejects.toThrow(
      'no chunk of the manifest registers "molecule"',
    );
  });
});

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
