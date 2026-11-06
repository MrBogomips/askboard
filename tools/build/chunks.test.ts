import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WIDGET_TYPES } from "@askboard/contract";
import {
  bundleChunk,
  type ChunkDefinition,
  COMPONENT_ROOTS,
  chunkComponents,
  chunkDefinitions,
  componentChunks,
  HOST_ONLY_CHUNKS,
  widgetChunkProblems,
} from "./chunks.ts";
import { collectNotices } from "./licences.ts";
import { CATALOG_DIR, PORT_FILE, ROOT, WIDGETS_SRC } from "./paths.ts";
import { portExports, sharedModules, sharedModulesPlugin } from "./shared-modules.ts";

// Component chunks found in the view's catalog and in the widgets (design decision 8), on scratch
// folders with a test-only `probe` widget, never a real widget.
let dir = "";
const write = (path: string, text: string) => Bun.write(join(dir, path), text);

// A widget registering itself through the `CatalogRenderer` port, as every widget does (AD-9).
const PROBE_SOURCE = `import { type ItemProps, register, useReadyAfterLayout } from "@askboard/view/catalog";

const Probe = (props: ItemProps) => {
  useReadyAfterLayout(props.ready);
  return <p className="text-sm">{props.item.id}</p>;
};

register("probe", Probe);
`;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "askboard-chunks-"));
  await write("catalog/choice/index.tsx", "export {};\n");
  await write("catalog/choice/single-choice.tsx", "export {};\n");
  await write("catalog/no-entry/index.ts", "export {};\n");
  await write("catalog/components.ts", "export {};\n");
  await write("widgets/index.ts", "export {};\n");
  await write("widgets/probe/index.tsx", PROBE_SOURCE);
  await write("widgets/shared/ids.ts", "export {};\n");
  await write("twice/choice/index.tsx", "export {};\n");
  await write("stray/kanban/index.tsx", "export {};\n");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

const roots = () => [join(dir, "catalog"), join(dir, "widgets")];
const components = (definitions: readonly ChunkDefinition[]) =>
  definitions.filter((definition) => definition.kind === "component");

describe("where component chunks are found (design decision 8)", () => {
  test("the view's catalog and the widgets' sources, by default", () => {
    expect(COMPONENT_ROOTS).toEqual([CATALOG_DIR, WIDGETS_SRC]);
    expect(WIDGETS_SRC).toBe(join(ROOT, "packages/widgets/src"));
  });

  test("a folder of either root holding an index.tsx is a component chunk named as it", async () => {
    expect(await componentChunks(roots())).toEqual([
      { name: "choice", kind: "component", entry: join(dir, "catalog/choice/index.tsx") },
      { name: "probe", kind: "component", entry: join(dir, "widgets/probe/index.tsx") },
    ]);
  });

  test("a folder without an index.tsx, such as shared/, and a file are no chunk", async () => {
    const names = (await componentChunks(roots())).map((chunk) => chunk.name);
    expect(names).not.toContain("shared");
    expect(names).not.toContain("no-entry");
    expect(names).not.toContain("index");
  });

  test("every chunk the build makes takes its components from the roots given", async () => {
    const work = join(dir, "work");
    const definitions = await chunkDefinitions(work, roots());
    expect(definitions.map((definition) => definition.kind).slice(0, 2)).toEqual([
      "shell",
      "library",
    ]);
    expect(components(definitions).map((definition) => definition.name)).toEqual([
      "choice",
      "probe",
    ]);
  });

  test("a name in two roots fails the build, naming both folders", async () => {
    const twice = [join(dir, "catalog"), join(dir, "twice")];
    const failure = await componentChunks(twice).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    const { message } = failure as Error;
    expect(message).toContain('"choice"');
    expect(message).toContain(join(dir, "catalog/choice"));
    expect(message).toContain(join(dir, "twice/choice"));
    await expect(chunkDefinitions(join(dir, "work"), twice)).rejects.toThrow('"choice"');
  });
});

describe("a widget's chunk", () => {
  test("bundles as a component chunk needing react and shell, with the repository's MIT notice", async () => {
    const definitions = await chunkDefinitions(join(dir, "work"), roots());
    const probe = components(definitions).find((definition) => definition.name === "probe");
    if (probe === undefined) throw new Error("no probe chunk");
    const needs = new Set<string>();
    const plugins = [sharedModulesPlugin(probe.name, sharedModules(await portExports()), needs)];
    const { code, inputs } = await bundleChunk(probe, plugins);
    expect([...needs].sort()).toEqual(["react", "shell"]);
    // The port is the shell's copy, not bundled into the chunk, and the chunk registers `probe`.
    expect(inputs).not.toContain(PORT_FILE);
    expect(code).toContain('"@askboard/view/catalog"');
    expect(code).toContain('"probe"');
    // A classic script: no import.meta, no import or export.
    expect(code).not.toMatch(/\bimport\s*\.\s*meta\b/);
    const { imports, exports } = new Bun.Transpiler({ loader: "js" }).scan(code);
    expect({ imports, exports }).toEqual({ imports: [], exports: [] });
    // Only AskBoard's own code is in it, under the repository's licence.
    const repository = (await Bun.file(join(ROOT, "LICENSE")).text()).trimEnd();
    const notices = (await collectNotices(probe.name, inputs, ROOT)).map(({ notice, text }) => ({
      scope: notice.package.split("/")[0],
      licence: notice.licence,
      text,
    }));
    expect(notices.length).toBeGreaterThan(0);
    for (const notice of notices) {
      expect(notice).toEqual({ scope: "@askboard", licence: "MIT", text: repository });
    }
  });
});

describe("the components a chunk registers", () => {
  test("a component chunk registers the component it is named after", () => {
    expect(chunkComponents("tree")).toEqual(["tree"]);
    expect(chunkComponents("probe")).toEqual(["probe"]);
  });

  test("the context chunk registers the three context items' components (excerpts, design decision 6)", () => {
    expect(chunkComponents("context")).toEqual(["excerpt", "image", "reference"]);
  });

  test("a name of the object prototype is no chunk's entry", () => {
    expect(chunkComponents("constructor")).toEqual(["constructor"]);
    expect(chunkComponents("toString")).toEqual(["toString"]);
  });
});

describe("host-only chunks (snapshot design decision 5)", () => {
  test("ext-apps is the one chunk only a view with a host loads, and the build marks it", async () => {
    expect([...HOST_ONLY_CHUNKS]).toEqual(["ext-apps"]);
    const definitions = await chunkDefinitions(join(dir, "work"), roots());
    const marked = definitions.filter((definition) => definition.hostOnly === true);
    expect(marked.map(({ name, kind }) => `${kind} ${name}`)).toEqual(["library ext-apps"]);
  });
});

describe("the widget types and their chunks (widget-registry, design decision 10)", () => {
  const probe = { type: "probe" };

  test("a registered type no component chunk registers fails, naming the type", async () => {
    const chunks = await componentChunks([join(dir, "catalog")]);
    const problems = widgetChunkProblems(chunks, [probe], join(dir, "widgets"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"probe"');
  });

  test("a widget folder holding a chunk whose name is no registered type fails, naming the folder", async () => {
    const chunks = await componentChunks([join(dir, "stray")]);
    const problems = widgetChunkProblems(chunks, [], join(dir, "stray"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(join(dir, "stray/kanban"));
  });

  test("a chunk for every registered type, and a catalog chunk beside them, pass", async () => {
    const chunks = await componentChunks(roots());
    expect(widgetChunkProblems(chunks, [probe], join(dir, "widgets"))).toEqual([]);
  });

  test("a type is registered by a chunk that lists it among its components, not only by its name", () => {
    const context = {
      name: "context",
      kind: "component" as const,
      entry: join(dir, "catalog/context/index.tsx"),
    };
    expect(widgetChunkProblems([context], [{ type: "image" }], join(dir, "widgets"))).toEqual([]);
  });

  test("today's catalogue passes: the Tree and the Gantt have their chunks, nothing else is a widget folder", async () => {
    expect(widgetChunkProblems(await componentChunks(), WIDGET_TYPES)).toEqual([]);
  });
});
