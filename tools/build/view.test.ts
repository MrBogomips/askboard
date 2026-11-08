import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  type BoardState,
  cspHashSource,
  type ManifestChunk,
  VIEW_MANIFEST_FILE,
  type ViewManifest,
} from "@askboard/contract";
import {
  CHART_FIXTURE_ITEMS,
  contextBoardDocument,
  ganttBoardDocument,
  ganttPlanBoardDocument,
  KANBAN_FIXTURE_ITEM,
  LATEX_FIXTURE_ITEM,
  lifecycleSnapshotData,
  plainChoiceBoardDocument,
  RANKING_FIXTURE_ITEM,
  SCALE_FIXTURE_ITEMS,
  TIMELINE_FIXTURE_ITEM,
  treeBoardDocument,
  uj2ExpandedBoardDocument,
} from "@askboard/contract/fixtures";
import { validateViewManifest } from "@askboard/contract/validate";
// `assemble` as the board page runs it, on this build; the root links no `@askboard/view`.
import {
  assemble,
  selectChunks,
  sourcesToFetch,
  targetOf,
} from "../../packages/view/src/assemble/index.ts";
import { questionsOf, type ViewDocument } from "../../packages/view/src/view-document.ts";
import { hostOnlyNeedProblems, styleUrlProblems } from "./checks.ts";
import { bundleChunk } from "./chunks.ts";
import { KATEX_VERSION } from "./katex-version.ts";
import { FONT_LICENCES, type FontLicence, type FontLicences } from "./licences.ts";
import { hashProblems, listedFiles } from "./manifest.ts";
import { ROOT, SIZES_FILE } from "./paths.ts";
import {
  LIBRARY_CHUNKS,
  portExports,
  sharedModules,
  sharedModulesPlugin,
} from "./shared-modules.ts";
import { formatSizes, readSizes, sizeProblems } from "./sizes.ts";
import { CHUNK_STYLESHEETS } from "./stylesheets.ts";
import { buildView, main } from "./view.ts";

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
      approval: "component",
      "board-graph": "library",
      chart: "component",
      choice: "component",
      context: "component",
      compute: "library",
      "date-field": "component",
      divider: "component",
      dnd: "library",
      "document-review": "component",
      "ext-apps": "library",
      gantt: "component",
      group: "component",
      kanban: "component",
      latex: "component",
      // The shared Markdown renderer: markdown-it, DOMPurify and the Markdown classes, in a library
      // chunk the Text and the Document review share (document-review, design decision 6).
      markdown: "library",
      "money-field": "component",
      "number-field": "component",
      // The PickField: Radix's Radio Group and Checkbox, in the radix chunk (form-widget, design decision 4).
      "pick-field": "component",
      radix: "library",
      ranking: "component",
      react: "library",
      row: "component",
      scale: "component",
      shell: "shell",
      stack: "component",
      tabs: "component",
      // The Text atom: markdown-it and DOMPurify in a chunk of its own (atoms, design decision 4).
      text: "component",
      "text-field": "component",
      timeline: "component",
      toggle: "component",
      tree: "component",
      value: "component",
    });
    expect(manifest.chunks.choice?.components).toEqual(["choice"]);
    expect(manifest.chunks.tree?.components).toEqual(["tree"]);
    // The Text atom needs no Radix: it renders through the markdown library chunk, which holds
    // markdown-it and DOMPurify (document-review, design decision 6).
    expect(manifest.chunks.text?.components).toEqual(["text"]);
    expect(manifest.chunks.text?.needs).toEqual(["markdown", "react", "shell"]);
    // The display atoms and the TextField are chunks of their own, each needing only React and the shell
    // (tasks 5.2 and 5.3); the Toggle also needs Radix's Switch, which the radix library chunk holds.
    for (const atom of ["value", "divider", "text-field", "number-field"]) {
      expect(manifest.chunks[atom]?.components).toEqual([atom]);
      expect(manifest.chunks[atom]?.needs).toEqual(["react", "shell"]);
    }
    expect(manifest.chunks.toggle?.needs).toEqual(["radix", "react", "shell"]);
    expect(manifest.chunks["pick-field"]?.components).toEqual(["pick-field"]);
    expect(manifest.chunks["pick-field"]?.needs).toEqual(["radix", "react", "shell"]);
    // The DateField's calendar is react-day-picker in Radix's Popover, with date-fns, all in its own
    // chunk (task 5.5; design decision 9).
    expect(manifest.chunks["date-field"]?.components).toEqual(["date-field"]);
    expect(manifest.chunks["date-field"]?.needs).toEqual(["radix", "react", "shell"]);
    // The MoneyField's currency control is Radix's Toggle Group (task 5.4).
    expect(manifest.chunks["money-field"]?.components).toEqual(["money-field"]);
    expect(manifest.chunks["money-field"]?.needs).toEqual(["radix", "react", "shell"]);
    // The Approval's decisions are Radix's Toggle Group; it needs no drag and no board graph
    // (approval-scale-ranking, design decision 8).
    expect(manifest.chunks.approval?.components).toEqual(["approval"]);
    expect(manifest.chunks.approval?.needs).toEqual(["radix", "react", "shell"]);
    // The Chart's canvas renderer is in its own chunk, which needs React and the shell's port alone
    // (chart-widget, design decision 8).
    expect(manifest.chunks.chart?.components).toEqual(["chart"]);
    expect(manifest.chunks.chart?.needs).toEqual(["react", "shell"]);
    // The Scale's slider and rating are Radix's Slider and Toggle Group, which the radix library
    // chunk has held since task 3.6 (design decision 9).
    expect(manifest.chunks.scale?.components).toEqual(["scale"]);
    expect(manifest.chunks.scale?.needs).toEqual(["radix", "react", "shell"]);
    // The Ranking's drag comes from the dnd chunk; it needs no Radix control, no board graph and
    // no compute (approval-scale-ranking, design decision 9).
    expect(manifest.chunks.ranking?.components).toEqual(["ranking"]);
    expect(manifest.chunks.ranking?.needs).toEqual(["dnd", "react", "shell"]);
    // The LaTeX draws with KaTeX, which its chunk bundles with its stylesheet: it needs no Radix
    // control, no drag, no board graph and no compute (latex-kanban-timeline, design decision 8).
    expect(manifest.chunks.latex?.components).toEqual(["latex"]);
    expect(manifest.chunks.latex?.needs).toEqual(["react", "shell"]);
    // The Kanban's drag comes from the dnd chunk and its "Move to…" menu is Radix's; it needs no
    // board graph and no compute (latex-kanban-timeline, design decision 9).
    expect(manifest.chunks.kanban?.components).toEqual(["kanban"]);
    expect(manifest.chunks.kanban?.needs).toEqual(["dnd", "radix", "react", "shell"]);
    // The Timeline moves by pointer, with no drag library; its "Move to lane…" menu is Radix's
    // (latex-kanban-timeline, design decision 10).
    expect(manifest.chunks.timeline?.components).toEqual(["timeline"]);
    expect(manifest.chunks.timeline?.needs).toEqual(["radix", "react", "shell"]);
    // Since the ask lifecycle the shell's tab strip is Radix Tabs (ask-lifecycle, task 6.2). Since
    // the Snapshot it takes ext-apps from the registry only with a host (snapshot task 3.2).
    expect(manifest.chunks.shell?.needs).toEqual(["radix", "react"]);
    expect(manifest.chunks.choice?.needs).toEqual(["radix", "react", "shell"]);
    // The Tree reads the board graph since the molecules change (design decision 13), and the
    // work breakdown's values need compute's `isFormulaError` and `roundNumber` (decision 14).
    // Its toolbar's "More" menu is Radix's (widget-editing-plus, review F-16), and its drag comes
    // from the dnd library chunk (approval-scale-ranking, design decision 9).
    expect(manifest.chunks.tree?.needs).toEqual([
      "board-graph",
      "compute",
      "dnd",
      "radix",
      "react",
      "shell",
    ]);
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

  test("the Tree's chunk holds AskBoard's own code under the repository's MIT licence, and the dnd chunk the drag library with its three dependencies under their own", async () => {
    // React and the port come from the react chunk and the shell (design decision 8); of `view`,
    // the chunk holds only the shared-module registry its imports of them read. Pragmatic drag
    // and drop (widget-editing-plus, task 5.1) is bundled with raf-schd, bind-event-listener and
    // @babel/runtime, each shipping its licence text, in the dnd chunk since approval-scale-ranking.
    const own = chunkNamed("tree").licences;
    expect(packagesIn(own)).toEqual(["@askboard/contract", "@askboard/view", "@askboard/widgets"]);
    const repository = (await Bun.file(join(ROOT, "LICENSE")).text()).trimEnd();
    for (const notice of own.filter((entry) => entry.package.startsWith("@askboard/"))) {
      expect(notice.licence).toBe("MIT");
      expect((await text(notice.path)).trimEnd()).toBe(repository);
    }
    const notices = chunkNamed("dnd").licences;
    expect(packagesIn(notices)).toEqual([
      "@askboard/view",
      "@atlaskit/pragmatic-drag-and-drop",
      "@babel/runtime",
      "bind-event-listener",
      "raf-schd",
    ]);
    const licences = Object.fromEntries(notices.map((entry) => [entry.package, entry.licence]));
    expect(licences).toMatchObject({
      "@atlaskit/pragmatic-drag-and-drop": "Apache-2.0",
      "@babel/runtime": "MIT",
      "bind-event-listener": "MIT",
      "raf-schd": "MIT",
    });
    const library = notices.find((entry) => entry.package === "@atlaskit/pragmatic-drag-and-drop");
    expect(await text(library?.path ?? "")).toContain("Apache License");
  });

  test("the drag library is in the dnd chunk only, which needs nothing, and the Tree loads it from there (approval-scale-ranking, design decision 9)", async () => {
    // The library adds an element named for its "honey pot" to the page while a drag runs.
    const marker = "data-pdnd-honey-pot";
    expect(chunkNamed("dnd").kind).toBe("library");
    expect(chunkNamed("dnd").needs).toEqual([]);
    expect(await text(chunkNamed("dnd").script.path)).toContain(marker);
    expect(await text(chunkNamed("tree").script.path)).not.toContain(marker);
    expect(await text(chunkNamed("tree").script.path)).toContain(
      '"@atlaskit/pragmatic-drag-and-drop/element/adapter"',
    );
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
      "approval",
      "board-graph",
      "board-page",
      "chart",
      "choice",
      "compute",
      "context",
      "date-field",
      "divider",
      "dnd",
      "document-review",
      "ext-apps",
      "gantt",
      "group",
      "kanban",
      "latex",
      "markdown",
      "money-field",
      "number-field",
      "pick-field",
      "radix",
      "ranking",
      "react",
      "row",
      "scale",
      "shell",
      "stack",
      "tabs",
      "text",
      "text-field",
      "timeline",
      "toggle",
      "tree",
      "value",
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

describe("ext-apps only with a host (snapshot design decision 5; No view-protocol code in a Snapshot)", () => {
  // A plain-question Snapshot: the lifecycle Snapshot's record over E1's plain Choice board.
  const plainSnapshot = {
    ...lifecycleSnapshotData,
    document: plainChoiceBoardDocument,
    state: openState(plainChoiceBoardDocument),
  };

  test("the manifest marks the ext-apps chunk host-only, and no other", () => {
    const marked = Object.entries(manifest.chunks).filter(([, chunk]) => chunk.hostOnly === true);
    expect(marked.map(([name]) => name)).toEqual(["ext-apps"]);
    expect(manifest.version).toBe("1.1");
  });

  test("no chunk that is not host-only needs it", () => {
    const chunks = Object.entries(manifest.chunks).map(([name, chunk]) => ({ name, ...chunk }));
    expect(hostOnlyNeedProblems(chunks)).toEqual([]);
  });

  test("a board takes it, and a plain-question Snapshot holds none of its code, hash or notices", async () => {
    const data = plainSnapshot;
    const selection = selectChunks(data.document, manifest, targetOf(data));
    const files = sourcesToFetch(selection);
    const chunks = Object.fromEntries(
      await Promise.all(files.map(async (file) => [file.sha256, await text(file.path)] as const)),
    );
    const paths = selection.flatMap(({ chunk }) => chunk.licences.map((notice) => notice.path));
    const licences = Object.fromEntries(
      await Promise.all(paths.map(async (path) => [path, await text(path)] as const)),
    );
    const snapshot = assemble(data, manifest, { chunks, licences });
    const board = await assembled(plainChoiceBoardDocument);
    const extApps = chunkNamed("ext-apps");
    const code = await text(extApps.script.path);
    expect(board.chunks).toContain("ext-apps");
    expect(board.srcdoc).toContain(code);
    expect(snapshot.chunks).toEqual(["react", "radix", "shell", "choice"]);
    expect(snapshot.srcdoc).not.toContain(code);
    expect(snapshot.policy).not.toContain(cspHashSource(extApps.script.sha256));
    const block = /id="askboard-licences">([\s\S]*?)<\/script>/.exec(snapshot.srcdoc)?.[1] ?? "";
    const notices = (JSON.parse(block) as { package: string }[]).map((notice) => notice.package);
    expect(notices).toContain("react");
    const inlined = new Set(selection.flatMap(({ chunk }) => packagesIn(chunk.licences)));
    const onlyExtApps = packagesIn(extApps.licences).filter((name) => !inlined.has(name));
    expect(onlyExtApps).toContain("@modelcontextprotocol/ext-apps");
    for (const name of onlyExtApps) expect(notices).not.toContain(name);
  });

  test("a static import of ext-apps records the need the build check fails on", async () => {
    const entry = join(dir, "static-ext-apps.ts");
    await Bun.write(
      entry,
      'import { App } from "@modelcontextprotocol/ext-apps";\nconsole.log(App);\n',
    );
    const needs = new Set<string>();
    const plugins = [sharedModulesPlugin("static", sharedModules(await portExports()), needs)];
    await bundleChunk({ name: "static", entry }, plugins);
    expect([...needs]).toEqual(["ext-apps"]);
    const chunks = [
      { name: "static", needs: [...needs] },
      { name: "ext-apps", hostOnly: true, needs: [] },
    ];
    expect(hostOnlyNeedProblems(chunks)).toEqual([
      expect.stringContaining('the chunk "static" needs the host-only chunk "ext-apps"'),
    ]);
  });
});

describe("only boards with a Tree load it (view spec, Widget chunks)", () => {
  test("the selection takes the tree chunk for a board holding a Tree, and not for the plain Choice board", () => {
    const names = (document: ViewDocument) =>
      selectChunks(document, manifest).map(({ name }) => name);
    // The shell needs the radix chunk since the ask lifecycle (Tabs, the "More" menu, the dialog).
    // Since the molecules change the Tree needs the board graph, and it compute (design decision 13).
    expect(names(treeBoardDocument)).toEqual([
      "compute",
      "board-graph",
      "dnd",
      "ext-apps",
      "react",
      "radix",
      "shell",
      "tree",
    ]);
    expect(names(plainChoiceBoardDocument)).toContain("choice");
    expect(names(plainChoiceBoardDocument)).not.toContain("tree");
  });

  test("the drag library's chunk goes with a Tree, and a board of Choice alone loads none (approval-scale-ranking, design decision 9)", async () => {
    const names = (document: ViewDocument) =>
      selectChunks(document, manifest).map(({ name }) => name);
    expect(names(treeBoardDocument)).toContain("dnd");
    expect(names(ganttBoardDocument)).not.toContain("dnd");
    expect(names(plainChoiceBoardDocument)).not.toContain("dnd");
    const library = chunkNamed("dnd");
    const plain = await assembled(plainChoiceBoardDocument);
    const withTree = await assembled(treeBoardDocument);
    expect(plain.chunks).not.toContain("dnd");
    expect(plain.srcdoc).not.toContain(await text(library.script.path));
    expect(withTree.chunks).toContain("dnd");
    expect(withTree.srcdoc).toContain(await text(library.script.path));
    expect(withTree.policy).toContain(cspHashSource(library.script.sha256));
  });

  test("a board whose only widget is a Ranking inlines the Ranking's chunk and the drag library's, and no Tree chunk (approval-scale-ranking, design decision 9)", async () => {
    const [question] = treeBoardDocument.items;
    const rankingBoard = {
      ...treeBoardDocument,
      items: [
        {
          ...question,
          props: { ...question.props, items: [RANKING_FIXTURE_ITEM] },
        },
      ],
    } as unknown as ViewDocument;
    const names = selectChunks(rankingBoard, manifest).map(({ name }) => name);
    expect(names).toContain("ranking");
    expect(names).toContain("dnd");
    expect(names).not.toContain("tree");
    expect(names).not.toContain("compute");
    const built = await assembled(rankingBoard);
    expect(built.chunks).toContain("ranking");
    expect(built.chunks).toContain("dnd");
    expect(built.chunks).not.toContain("tree");
    expect(built.srcdoc).toContain(await text(chunkNamed("ranking").script.path));
    expect(built.srcdoc).toContain(await text(chunkNamed("dnd").script.path));
    expect(built.srcdoc).not.toContain(await text(chunkNamed("tree").script.path));
  });

  test("a board whose only widget is a LaTeX inlines the LaTeX's chunk and no Tree, Ranking or drag chunk (latex-kanban-timeline, design decision 8)", async () => {
    const [question] = treeBoardDocument.items;
    const latexBoard = {
      ...treeBoardDocument,
      items: [{ ...question, props: { ...question.props, items: [LATEX_FIXTURE_ITEM] } }],
    } as unknown as ViewDocument;
    const names = selectChunks(latexBoard, manifest).map(({ name }) => name);
    expect(names).toContain("latex");
    for (const other of ["tree", "ranking", "dnd", "compute", "gantt"]) {
      expect(names).not.toContain(other);
    }
    const built = await assembled(latexBoard);
    expect(built.chunks).toContain("latex");
    expect(built.chunks).not.toContain("tree");
    expect(built.srcdoc).toContain(await text(chunkNamed("latex").script.path));
    expect(built.srcdoc).not.toContain(await text(chunkNamed("tree").script.path));
  });

  test("a board whose only TextField sits in a Group holds the group and text-field chunks (layouts, task 3.2)", async () => {
    const [question] = treeBoardDocument.items;
    const grouped = {
      type: "group",
      id: "contact",
      props: {
        title: "Contact",
        items: [{ type: "text-field", id: "phone", props: { label: "Phone" } }],
      },
    };
    const board = {
      ...treeBoardDocument,
      items: [{ ...question, props: { ...question.props, items: [grouped] } }],
    } as unknown as ViewDocument;
    const names = selectChunks(board, manifest).map(({ name }) => name);
    expect(names).toContain("group");
    expect(names).toContain("text-field");
    for (const other of ["tree", "ranking", "row", "stack", "gantt"]) {
      expect(names).not.toContain(other);
    }
    const built = await assembled(board);
    expect(built.srcdoc).toContain(await text(chunkNamed("group").script.path));
    expect(built.srcdoc).toContain(await text(chunkNamed("text-field").script.path));
    expect(built.srcdoc).not.toContain(await text(chunkNamed("row").script.path));
  });

  test("a board whose only widget is a Kanban inlines the Kanban's chunk and the drag library's, and no Tree or Ranking chunk (latex-kanban-timeline, design decision 9)", async () => {
    const [question] = treeBoardDocument.items;
    const kanbanBoard = {
      ...treeBoardDocument,
      items: [{ ...question, props: { ...question.props, items: [KANBAN_FIXTURE_ITEM] } }],
    } as unknown as ViewDocument;
    const names = selectChunks(kanbanBoard, manifest).map(({ name }) => name);
    expect(names).toContain("kanban");
    expect(names).toContain("dnd");
    for (const other of ["tree", "ranking", "compute", "board-graph", "gantt", "latex"]) {
      expect(names).not.toContain(other);
    }
    const built = await assembled(kanbanBoard);
    expect(built.chunks).toContain("kanban");
    expect(built.chunks).toContain("dnd");
    expect(built.chunks).not.toContain("tree");
    expect(built.chunks).not.toContain("ranking");
    expect(built.srcdoc).toContain(await text(chunkNamed("kanban").script.path));
    expect(built.srcdoc).toContain(await text(chunkNamed("dnd").script.path));
    expect(built.srcdoc).not.toContain(await text(chunkNamed("tree").script.path));
    expect(built.srcdoc).not.toContain(await text(chunkNamed("ranking").script.path));
  });

  test("a board whose only widget is a Timeline inlines the Timeline's chunk and no drag, Gantt, Tree or Ranking chunk (latex-kanban-timeline, design decision 10)", async () => {
    const [question] = treeBoardDocument.items;
    const timelineBoard = {
      ...treeBoardDocument,
      items: [{ ...question, props: { ...question.props, items: [TIMELINE_FIXTURE_ITEM] } }],
    } as unknown as ViewDocument;
    const names = selectChunks(timelineBoard, manifest).map(({ name }) => name);
    expect(names).toContain("timeline");
    for (const other of ["tree", "ranking", "dnd", "compute", "board-graph", "gantt", "kanban"]) {
      expect(names).not.toContain(other);
    }
    const built = await assembled(timelineBoard);
    expect(built.chunks).toContain("timeline");
    expect(built.chunks).not.toContain("gantt");
    expect(built.srcdoc).toContain(await text(chunkNamed("timeline").script.path));
    expect(built.srcdoc).not.toContain(await text(chunkNamed("gantt").script.path));
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
    expect(plain.policy).toContain(cspHashSource(script.sha256));
  });
});

describe("the Chart's chunk (chart-widget, design decisions 8 and 9; view spec, The Chart's chunk)", () => {
  const boardOf = (...items: readonly unknown[]): ViewDocument => {
    const [question] = treeBoardDocument.items;
    return {
      ...treeBoardDocument,
      items: [{ ...question, props: { ...question.props, items } }],
    } as unknown as ViewDocument;
  };
  const scaleBoard = boardOf(SCALE_FIXTURE_ITEMS[0]);
  const chartBoard = boardOf(CHART_FIXTURE_ITEMS[0]);

  test("a board holding only a Scale inlines no chart chunk, and a board holding a Chart inlines it", async () => {
    const { script } = chunkNamed("chart");
    const code = await text(script.path);
    const names = (document: ViewDocument) =>
      selectChunks(document, manifest).map(({ name }) => name);
    expect(names(scaleBoard)).toContain("scale");
    expect(names(scaleBoard)).not.toContain("chart");
    expect(names(chartBoard)).toContain("chart");
    expect(names(plainChoiceBoardDocument)).not.toContain("chart");
    const withScale = await assembled(scaleBoard);
    expect(withScale.chunks).not.toContain("chart");
    expect(withScale.srcdoc).not.toContain(code);
    expect(withScale.policy).toContain(cspHashSource(script.sha256));
    const withChart = await assembled(chartBoard);
    expect(withChart.chunks).toContain("chart");
    expect(withChart.srcdoc).toContain(code);
    expect(withChart.policy).toContain(cspHashSource(script.sha256));
  });

  test("the chunk registers chart, needs React and the shell alone, and is a component chunk", () => {
    const chunk = chunkNamed("chart");
    expect(chunk.kind).toBe("component");
    expect(chunk.components).toEqual(["chart"]);
    expect(chunk.needs).toEqual(["react", "shell"]);
  });

  test("its notices name echarts under Apache-2.0 with its NOTICE text, zrender under BSD-3-Clause and tslib under 0BSD", async () => {
    const notices = chunkNamed("chart").licences;
    expect(packagesIn(notices)).toEqual([
      "@askboard/contract",
      "@askboard/view",
      "@askboard/widgets",
      "echarts",
      "tslib",
      "zrender",
    ]);
    const by = Object.fromEntries(notices.map((entry) => [entry.package, entry]));
    expect(by.echarts?.licence).toBe("Apache-2.0");
    expect(by.zrender?.licence).toBe("BSD-3-Clause");
    expect(by.tslib?.licence).toBe("0BSD");
    const echarts = await text(by.echarts?.path ?? "");
    expect(echarts).toContain("Apache License");
    expect(echarts).toContain("Apache ECharts\nCopyright 2017-");
    expect(echarts).toContain(
      "This product includes software developed at\nThe Apache Software Foundation",
    );
    expect(await text(by.zrender?.path ?? "")).toContain("Baidu");
    expect(await text(by.tslib?.path ?? "")).toContain(
      "Permission to use, copy, modify, and/or distribute this software for any",
    );
  });

  test("the library chunks are the six there were and the Markdown renderer: the chart's library goes in its own chunk", () => {
    expect(
      Object.fromEntries(
        Object.entries(LIBRARY_CHUNKS).map(([name, { modules }]) => [name, Object.keys(modules)]),
      ),
    ).toEqual({
      react: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
      radix: ["radix-ui"],
      "ext-apps": ["@modelcontextprotocol/ext-apps"],
      compute: ["@askboard/compute"],
      "board-graph": ["@askboard/widgets/board-graph"],
      dnd: [
        "@atlaskit/pragmatic-drag-and-drop/combine",
        "@atlaskit/pragmatic-drag-and-drop/element/adapter",
      ],
      markdown: ["@askboard/view/markdown"],
    });
    expect(Object.keys(manifest.chunks).filter((name) => name.includes("echarts"))).toEqual([]);
    expect(Object.keys(manifest.chunks)).not.toContain("zrender");
  });

  // The d3-derived `quantile` of echarts' `util/number` stays out of the chunk. The minified chunk
  // has no names to search: the same entry is bundled unminified, with a probe importing it to
  // prove the search sees it. (Time.js, which the chunk does hold, has d3-derived tables too: the
  // next test checks that d3's licence text ships.)
  const unminified = async (entry: string): Promise<string> => {
    const needs = new Set<string>();
    const result = await Bun.build({
      entrypoints: [entry],
      format: "iife",
      target: "browser",
      minify: false,
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [sharedModulesPlugin("chart", sharedModules(await portExports()), needs)],
    });
    const output = result.outputs.find((file) => file.kind === "entry-point");
    if (!result.success || output === undefined) throw new Error(result.logs.join("\n"));
    return output.text();
  };

  test("the chunk holds none of echarts' d3-derived code", async () => {
    const number = join(ROOT, "packages/widgets/node_modules/echarts/lib/util/number.js");
    const probe = join(dir, "probe-quantile.ts");
    await Bun.write(
      probe,
      `import { quantile } from ${JSON.stringify(number)};\nconsole.log(quantile);\n`,
    );
    expect(await unminified(probe)).toContain("quantile");
    const chart = await unminified(join(ROOT, "packages/widgets/src/chart/index.tsx"));
    expect(chart).not.toContain("quantile");
  }, 60_000);

  // A source file of echarts whose header says a third-party licence is embedded ("see
  // </licenses/LICENSE-d3>") obliges the notices of the chunk holding it to carry that text
  // (review of group 5, X-1). Each input file of the chunk, from the bundler's metafile, is read.
  test("every third-party licence a bundled echarts file says it embeds is among the chunk's notices", async () => {
    const result = await Bun.build({
      entrypoints: [join(ROOT, "packages/widgets/src/chart/index.tsx")],
      format: "iife",
      target: "browser",
      minify: false,
      metafile: true,
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [
        sharedModulesPlugin("chart", sharedModules(await portExports()), new Set<string>()),
      ],
    });
    if (!result.success || result.metafile === undefined) throw new Error(result.logs.join("\n"));
    const embedded = new Map<string, string[]>();
    for (const input of Object.keys(result.metafile.inputs)) {
      if (!input.includes("/echarts/")) continue;
      const source = await Bun.file(resolve(ROOT, input)).text();
      for (const [, name] of source.matchAll(/<\/?licenses\/(LICENSE-[A-Za-z0-9._-]+)>/g)) {
        embedded.set(name ?? "", [...(embedded.get(name ?? "") ?? []), basename(input)]);
      }
    }
    // The chunk does hold Time.js, which names LICENSE-d3.
    expect(embedded.get("LICENSE-d3")).toContain("Time.js");
    const notices = chunkNamed("chart").licences;
    const echarts = await text(notices.find((entry) => entry.package === "echarts")?.path ?? "");
    for (const name of embedded.keys()) {
      const file = join(ROOT, "packages/widgets/node_modules/echarts/licenses", name);
      const licence = (await Bun.file(file).text()).trim();
      expect({ name, shipped: echarts.includes(licence) }).toEqual({ name, shipped: true });
    }
  }, 60_000);
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
    expect(graph).toContain('"@askboard/widgets/board-graph"');
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
      "dnd",
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
      expect(plain.policy).toContain(cspHashSource(script.sha256));
    }
  });
});

describe("the board graph chunk (molecules, design decision 13; view spec, The board graph chunk)", () => {
  test("it holds only AskBoard's own code, under the repository's MIT licence", async () => {
    // compute and the port come from their chunks; of `view`, it holds only the registry; of
    // `contract`, the plan limits the plan-link rules check (design decision 12).
    const notices = chunkNamed("board-graph").licences;
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

describe("the context chunk (excerpts, design decision 6; view spec, Context items)", () => {
  test("it registers excerpt, image and reference, needing React and the shell", () => {
    expect(chunkNamed("context").components).toEqual(["excerpt", "image", "reference"]);
    expect(chunkNamed("context").needs).toEqual(["react", "shell"]);
  });

  test("it holds only AskBoard's own code, no schema, no Ajv and no code made from text", async () => {
    expect(packagesIn(chunkNamed("context").licences)).toEqual(["@askboard/view"]);
    const context = await text(chunkNamed("context").script.path);
    expect(context).toContain('"excerpt"');
    expect(context).not.toMatch(/\bimport\s*\.\s*meta\b/);
    expect(context).not.toContain("urn:askboard");
    expect(context).not.toMatch(/\bajv\b/i);
    expect(context).not.toMatch(/\bnew Function\b|\beval\(/);
  });

  test("the selection takes it for a board holding a context item, and not for the plain Choice board", () => {
    const names = (document: ViewDocument) =>
      selectChunks(document, manifest).map(({ name }) => name);
    expect(names(contextBoardDocument)).toEqual([
      "ext-apps",
      "react",
      "radix",
      "shell",
      "choice",
      "context",
    ]);
    expect(names(plainChoiceBoardDocument)).not.toContain("context");
    expect(names(treeBoardDocument)).not.toContain("context");
  });

  test("the context board's srcdoc inlines it, and the plain Choice board's does not", async () => {
    const { script } = chunkNamed("context");
    const code = await text(script.path);
    const withContext = await assembled(contextBoardDocument);
    const plain = await assembled(plainChoiceBoardDocument);
    expect(withContext.chunks).toContain("context");
    expect(withContext.srcdoc).toContain(code);
    expect(withContext.policy).toContain(cspHashSource(script.sha256));
    expect(plain.chunks).not.toContain("context");
    expect(plain.srcdoc).not.toContain(code);
    expect(plain.policy).toContain(cspHashSource(script.sha256));
  });
});

describe("the Markdown renderer's chunk (document-review, design decision 6; view spec, The shared Markdown renderer)", () => {
  // The plain-choice board with the question's items replaced by `items`, or its first option's
  // preview given as Markdown.
  const withItems = (items: readonly unknown[]): ViewDocument => {
    const [question] = plainChoiceBoardDocument.items;
    return {
      ...plainChoiceBoardDocument,
      items: [{ ...question, props: { ...question.props, items } }],
    } as unknown as ViewDocument;
  };
  const withPreview = (previewFormat: "plain" | "markdown"): ViewDocument => {
    const [question] = plainChoiceBoardDocument.items;
    const [first, ...rest] = question.props.options ?? [];
    return {
      ...plainChoiceBoardDocument,
      items: [
        {
          ...question,
          props: {
            ...question.props,
            options: [{ ...first, preview: "**bold** preview", previewFormat }, ...rest],
          },
        },
      ],
    } as unknown as ViewDocument;
  };
  const names = (document: ViewDocument) =>
    selectChunks(document, manifest).map(({ name }) => name);
  const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

  test("it is a library chunk that needs nothing", () => {
    expect(chunkNamed("markdown").kind).toBe("library");
    expect(chunkNamed("markdown").needs).toEqual([]);
  });

  test("its notices name markdown-it and DOMPurify, and the text chunk's do not", () => {
    const library = packagesIn(chunkNamed("markdown").licences);
    expect(library).toContain("markdown-it");
    expect(library).toContain("dompurify");
    const text = packagesIn(chunkNamed("text").licences);
    expect(text).not.toContain("markdown-it");
    expect(text).not.toContain("dompurify");
  });

  test("the text chunk holds none of the renderer's code, and the markdown chunk does", async () => {
    const library = await text(chunkNamed("markdown").script.path);
    const own = await text(chunkNamed("text").script.path);
    // The sanitizer's list of tags and markdown-it's table rule are the renderer's.
    expect(library).toContain("blockquote");
    expect(library).toContain("ALLOWED_TAGS");
    expect(own).not.toContain("ALLOWED_TAGS");
    expect(own.length).toBeLessThan(library.length / 4);
    expect(own).toContain('"@askboard/view/markdown"');
  });

  test("its styles carry the Markdown element classes, and the text chunk's do not", async () => {
    const css = async (name: string) =>
      (await Promise.all(chunkNamed(name).styles.map((file) => text(file.path)))).join("\n");
    expect(await css("markdown")).toContain("blockquote");
    expect(await css("text")).not.toContain("blockquote");
  });

  test("a board of a Choice and a Chart inlines no markdown chunk", async () => {
    const chart = CHART_FIXTURE_ITEMS[0];
    const board = withItems([chart]);
    expect(names(board)).not.toContain("markdown");
    const built = await assembled(board);
    expect(built.chunks).not.toContain("markdown");
    expect(built.srcdoc).not.toContain(await text(chunkNamed("markdown").script.path));
  });

  test("a Choice with a plain preview inlines no markdown chunk either", () => {
    expect(names(withPreview("plain"))).not.toContain("markdown");
    expect(names(plainChoiceBoardDocument)).not.toContain("markdown");
  });

  test("a board holding a Markdown Text inlines the markdown chunk once, before the text chunk", async () => {
    const markdownText = {
      type: "text",
      id: "notes",
      props: { text: "**x**", format: "markdown" },
    };
    const board = withItems([markdownText, { ...markdownText, id: "more" }]);
    const order = names(board);
    expect(order).toContain("markdown");
    expect(order.filter((name) => name === "markdown")).toHaveLength(1);
    expect(order.indexOf("markdown")).toBeLessThan(order.indexOf("text"));
    const built = await assembled(board);
    const script = await text(chunkNamed("markdown").script.path);
    expect(occurrences(built.srcdoc, script)).toBe(1);
    expect(built.policy).toContain(cspHashSource(chunkNamed("markdown").script.sha256));
  });

  test("a board holding only plain Texts (format plain, and none) inlines the markdown chunk once: the text chunk needs it (task 4.4)", async () => {
    const plainText = { type: "text", id: "plain", props: { text: "x", format: "plain" } };
    const bareText = { type: "text", id: "bare", props: { text: "y" } };
    const board = withItems([plainText, bareText]);
    const order = names(board);
    expect(order.filter((name) => name === "markdown")).toHaveLength(1);
    expect(order.indexOf("markdown")).toBeLessThan(order.indexOf("text"));
    const built = await assembled(board);
    expect(occurrences(built.srcdoc, await text(chunkNamed("markdown").script.path))).toBe(1);
    expect(built.chunks).toContain("markdown");
  });

  test("a board holding a Markdown preview inlines the markdown chunk once, through the text chunk", async () => {
    const board = withPreview("markdown");
    const order = names(board);
    expect(order).toContain("text");
    expect(order.filter((name) => name === "markdown")).toHaveLength(1);
    const built = await assembled(board);
    expect(occurrences(built.srcdoc, await text(chunkNamed("markdown").script.path))).toBe(1);
  });
});

describe("the Document review's chunk (document-review, task 6.3; view spec, The shared Markdown renderer)", () => {
  const review = { type: "document-review", id: "review", props: { markdown: "Some **text**." } };
  const markdownText = { type: "text", id: "notes", props: { text: "**x**", format: "markdown" } };
  const boardOf = (...items: readonly unknown[]): ViewDocument => {
    const [question] = plainChoiceBoardDocument.items;
    return {
      ...plainChoiceBoardDocument,
      items: [{ ...question, props: { ...question.props, items } }],
    } as unknown as ViewDocument;
  };
  const names = (document: ViewDocument) =>
    selectChunks(document, manifest).map(({ name }) => name);
  const occurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

  test("it registers document-review as a component chunk needing the Markdown renderer, Radix, React and the shell", () => {
    const chunk = chunkNamed("document-review");
    expect(chunk.kind).toBe("component");
    expect(chunk.components).toEqual(["document-review"]);
    expect(chunk.needs).toEqual(["markdown", "radix", "react", "shell"]);
  });

  test("it bundles no react-dom code of its own: its notices name none, and it reads React DOM from the react library chunk", async () => {
    const chunk = chunkNamed("document-review");
    const own = await text(chunk.script.path);
    const library = await text(chunkNamed("react").script.path);
    const packages = packagesIn(chunk.licences);
    for (const name of ["react-dom", "react", "scheduler", "markdown-it", "dompurify"]) {
      expect(packages, name).not.toContain(name);
    }
    // The chunk asks the shared-module registry for `react-dom` by name, as the text chunk does for
    // the renderer, and holds none of the library: a fraction of the react chunk's size.
    expect(own).toContain('"react-dom"');
    expect(own.length).toBeLessThan(library.length / 4);
  });

  test("no component chunk holds markdown-it or DOMPurify code or a notice for them, so only the markdown library does (no ALLOWED_TAGS)", async () => {
    const components = Object.entries(manifest.chunks).filter(
      ([, chunk]) => chunk.kind === "component",
    );
    expect(components.map(([name]) => name)).toContain("document-review");
    for (const [name, chunk] of components) {
      const packages = packagesIn(chunk.licences);
      expect(packages, name).not.toContain("markdown-it");
      expect(packages, name).not.toContain("dompurify");
      expect(await text(chunk.script.path), name).not.toContain("ALLOWED_TAGS");
    }
    expect(await text(chunkNamed("markdown").script.path)).toContain("ALLOWED_TAGS");
  });

  test("a board whose only widget is a Document review inlines its chunk and the markdown chunk once, and no Text chunk", async () => {
    const board = boardOf(review);
    const order = names(board);
    expect(order).toContain("document-review");
    expect(order.filter((name) => name === "markdown")).toHaveLength(1);
    expect(order.indexOf("markdown")).toBeLessThan(order.indexOf("document-review"));
    expect(order).not.toContain("text");
    const built = await assembled(board);
    expect(occurrences(built.srcdoc, await text(chunkNamed("markdown").script.path))).toBe(1);
    expect(built.policy).toContain(cspHashSource(chunkNamed("document-review").script.sha256));
  });

  test("a board holding a Markdown Text and a Document review inlines the markdown chunk once, and both render through it", async () => {
    const board = boardOf(markdownText, review);
    const order = names(board);
    expect(order.filter((name) => name === "markdown")).toHaveLength(1);
    expect(order).toContain("text");
    expect(order).toContain("document-review");
    expect(order.indexOf("markdown")).toBeLessThan(order.indexOf("text"));
    expect(order.indexOf("markdown")).toBeLessThan(order.indexOf("document-review"));
    const built = await assembled(board);
    expect(occurrences(built.srcdoc, await text(chunkNamed("markdown").script.path))).toBe(1);
    expect(occurrences(built.srcdoc, await text(chunkNamed("document-review").script.path))).toBe(
      1,
    );
  });

  test("a board without one inlines neither of its chunks", async () => {
    const built = await assembled(plainChoiceBoardDocument);
    expect(built.chunks).not.toContain("document-review");
    expect(built.srcdoc).not.toContain(await text(chunkNamed("document-review").script.path));
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

describe("package stylesheets in a chunk (latex-kanban-timeline, design decision 8)", () => {
  const FONT = new Uint8Array([0x77, 0x4f, 0x46, 0x32, 7, 7, 7]);
  const sheet = async (name: string, css: string) => {
    const path = join(dir, name);
    await Bun.write(path, css);
    return path;
  };

  // The stylesheet's fonts lie in a package, as a real package's do, whose font licence the build
  // reads from a test table (task 3.4 moved this fixture from a bare temporary folder).
  const PACKAGE_FONTS = (over: Partial<FontLicence> = {}): FontLicence => ({
    licence: "OFL-1.1",
    fonts: "pkg-fonts",
    derived: [],
    source: "https://example.com/OFL.txt",
    date: "2026-11-07",
    reason: "a test table",
    text: "PKG FONT NOTICE\n",
    ...over,
  });
  const TABLE: FontLicences = { "pkg@1.0.0": PACKAGE_FONTS() };
  const noticeText = async (target: string, built: { manifest: ViewManifest }, name: string) => {
    const notice = built.manifest.chunks.choice?.licences.find((n) => n.package === name);
    const text = notice === undefined ? "" : await Bun.file(join(target, notice.path)).text();
    return { notice, text };
  };
  const packageSheet = async () => {
    const root = join(dir, "node_modules", "pkg");
    await Bun.write(
      join(root, "package.json"),
      JSON.stringify({ name: "pkg", version: "1.0.0", license: "MIT" }),
    );
    await Bun.write(join(root, "LICENSE"), "MIT License\n\nCopyright (c) Pkg\n");
    await Bun.write(join(root, "pkg-fonts", "f.woff2"), FONT);
    await Bun.write(join(root, "pkg-fonts", "f.woff"), new Uint8Array([1]));
    const path = join(root, "pkg.css");
    await Bun.write(
      path,
      "@font-face{font-family:P;src:url(pkg-fonts/f.woff2) format('woff2'),url(pkg-fonts/f.woff) format('woff')}.pkg{font-family:P}",
    );
    return path;
  };

  test("a listed stylesheet follows Tailwind's styles in its chunk, with its font inlined", async () => {
    const path = await packageSheet();
    const target = join(dir, "pkg-build");
    const built = await buildView(target, { choice: [path] }, TABLE);
    const file = built.manifest.chunks.choice?.styles[0]?.path ?? "";
    const css = await Bun.file(join(target, file)).text();
    expect(css).toContain("var(--");
    expect(css.indexOf(".pkg{font-family:P}")).toBeGreaterThan(css.indexOf("var(--"));
    expect(css).toContain(`url(data:font/woff2;base64,${Buffer.from(FONT).toString("base64")})`);
    expect(css).not.toContain("f.woff");
    await expect(
      buildView(join(dir, "pkg-build-2"), { choice: [path], nothing: [path] }, TABLE),
    ).rejects.toThrow('"nothing"');
  }, 120_000);

  test("a chunk whose script does not import the package still holds its notice, with the fonts' licence beside the package's (review X-3)", async () => {
    const path = await packageSheet();
    const target = join(dir, "pkg-notice-build");
    const built = await buildView(target, { choice: [path] }, TABLE);
    const { notice, text } = await noticeText(target, built, "pkg");
    expect(notice).toMatchObject({ package: "pkg", version: "1.0.0", licence: "MIT AND OFL-1.1" });
    const holds = text;
    expect(holds).toContain("Copyright (c) Pkg");
    expect(holds.indexOf("PKG FONT NOTICE")).toBeGreaterThan(holds.indexOf("Copyright (c) Pkg"));
    const choice = built.manifest.chunks.choice;
    expect(choice?.licences.map((n) => n.package)).not.toContain("react");
  }, 120_000);

  test("a stylesheet without fonts, from a package with no entry, still gives that package's notice (review X-3)", async () => {
    const root = join(dir, "node_modules", "plainpkg");
    await Bun.write(
      join(root, "package.json"),
      JSON.stringify({ name: "plainpkg", version: "3.0.0", license: "ISC" }),
    );
    await Bun.write(join(root, "LICENSE"), "ISC License\n\nCopyright (c) Plain\n");
    await Bun.write(join(root, "plain.css"), ".plain{color:red}");
    const target = join(dir, "plain-notice-build");
    const built = await buildView(target, { choice: [join(root, "plain.css")] }, {});
    const { notice, text } = await noticeText(target, built, "plainpkg");
    expect(notice).toMatchObject({ version: "3.0.0", licence: "ISC" });
    expect(text).toContain("Copyright (c) Plain");
  }, 120_000);

  test("inlined fonts of a package version with no entry fail the build, naming the package version and the chunk", async () => {
    const path = await packageSheet();
    const error = await buildView(join(dir, "no-entry-build"), { choice: [path] }, {}).catch(
      (e) => e,
    );
    expect(String(error)).toContain("pkg@1.0.0");
    expect(String(error)).toContain('"choice"');
    expect(String(error)).toContain("no entry");
  }, 120_000);

  test("an entry no chunk inlines the fonts of or bundles a file derived from fails the build as stale", async () => {
    const path = await packageSheet();
    const table = { ...TABLE, "other@2.0.0": PACKAGE_FONTS() };
    const error = await buildView(join(dir, "stale-build"), { choice: [path] }, table).catch(
      (e) => e,
    );
    expect(String(error)).toContain('"other@2.0.0"');
    expect(String(error)).toContain("stale");
  }, 120_000);

  test("with the real stylesheets, a font-licence entry no chunk uses fails the build as stale (task 5.1 removed the gate that skipped the check)", async () => {
    const table = { ...FONT_LICENCES, "other@2.0.0": PACKAGE_FONTS() };
    const error = await buildView(join(dir, "real-stale-build"), CHUNK_STYLESHEETS, table).catch(
      (e) => e,
    );
    expect(String(error)).toContain('"other@2.0.0"');
    expect(String(error)).toContain("stale");
  }, 120_000);

  test("the real build's latex chunk carries KaTeX's stylesheet and the `katex` notice `MIT AND OFL-1.1` with the OFL text and the outlines' file named", async () => {
    expect(CHUNK_STYLESHEETS).toEqual({ latex: ["katex/dist/katex.min.css"] });
    const latex = chunkNamed("latex");
    const notice = latex.licences.find((n) => n.package === "katex");
    expect(notice).toMatchObject({ version: KATEX_VERSION, licence: "MIT AND OFL-1.1" });
    const holds = await text(notice?.path ?? "none");
    expect(holds).toContain("Khan Academy and other contributors");
    expect(holds).toContain("SIL OPEN FONT LICENSE");
    expect(holds).toContain("Reserved Font Name");
    expect(holds).toContain("dist/katex.mjs");
    const styles = await text(latex.styles[0]?.path ?? "none");
    expect(styles).toContain(".katex");
    expect(styles.match(/url\(data:font\/woff2;base64,/g)).toHaveLength(20);
    expect(styles).not.toMatch(/url\((?!data:font\/woff2)/);
    expect(latex.styles).toHaveLength(1);
  });

  test("an entry under a licence the rule does not admit fails the build", async () => {
    const path = await packageSheet();
    const table = { "pkg@1.0.0": PACKAGE_FONTS({ licence: "GPL-3.0-only" }) };
    const error = await buildView(join(dir, "gpl-build"), { choice: [path] }, table).catch(
      (e) => e,
    );
    expect(String(error)).toContain('"pkg@1.0.0"');
    expect(String(error)).toContain("GPL-3.0-only");
  }, 120_000);

  test("KaTeX's stylesheet gives its chunk the `katex` notice `MIT AND OFL-1.1` with KaTeX's licence and the OFL, and every font decodes to a woff2 file of the package", async () => {
    const target = join(dir, "katex-build");
    const built = await buildView(target, { choice: ["katex/dist/katex.min.css"] });
    const { notice, text } = await noticeText(target, built, "katex");
    expect(notice).toMatchObject({ version: KATEX_VERSION, licence: "MIT AND OFL-1.1" });
    const holds = text;
    expect(holds).toContain("Khan Academy and other contributors");
    expect(holds).toContain("Permission is hereby granted");
    expect(holds).toContain("Copyright (c) 2009-2010, Design Science, Inc.");
    expect(holds).toContain("with Reserved Font Names KaTeX_AMS");
    expect(holds).toContain("SIL OPEN FONT LICENSE");
    const files = built.manifest.chunks.choice?.styles ?? [];
    const css = await Bun.file(join(target, files[0]?.path ?? "none")).text();
    const urls = [...css.matchAll(/url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)/g)];
    expect(urls).toHaveLength(20);
    const fontDir = join(ROOT, "packages/widgets/node_modules/katex/dist/fonts");
    const hashes = new Set<string>();
    for (const name of (await readdir(fontDir)).filter((file) => file.endsWith(".woff2"))) {
      hashes.add(
        createHash("sha256")
          .update(await Bun.file(join(fontDir, name)).bytes())
          .digest("hex"),
      );
    }
    expect(hashes.size).toBe(20);
    for (const [, base64] of urls) {
      const bytes = Buffer.from(base64 as string, "base64");
      expect(hashes.has(createHash("sha256").update(bytes).digest("hex"))).toBe(true);
    }
  }, 120_000);

  test("a listed stylesheet that names a file fails the build, naming the chunk and the URL", async () => {
    const path = await sheet("bad.css", ".bad{background:url(img/a.svg)}");
    const error = await buildView(join(dir, "bad-build"), { choice: [path] }, {}).catch((e) => e);
    expect(String(error)).toContain('"choice"');
    expect(String(error)).toContain("img/a.svg");
  }, 120_000);

  test("a listed stylesheet with an @import fails the build, naming the chunk and the import", async () => {
    const path = await sheet("import.css", '@import "other.css";.a{}');
    const error = await buildView(join(dir, "import-build"), { choice: [path] }, {}).catch(
      (e) => e,
    );
    expect(String(error)).toContain('"choice"');
    expect(String(error)).toContain("@import");
  }, 120_000);

  test("every chunk's styles and the board page's pass the URL check", async () => {
    const files = [
      ...manifest.boardPage.styles,
      ...Object.values(manifest.chunks).flatMap((c) => c.styles),
    ];
    expect(files.length).toBeGreaterThan(3);
    for (const { path } of files) expect(styleUrlProblems(path, await text(path))).toEqual([]);
  });
});
