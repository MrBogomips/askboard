import { describe, expect, test } from "bun:test";
import {
  type LifecycleBoardDocument,
  type ManifestChunk,
  type SnapshotData,
  type SnapshotRender,
  VIEW_MANIFEST_VERSION,
  type ViewManifest,
} from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  lifecycleSnapshotData,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import { validateViewManifest } from "@askboard/contract/validate";
import type { BootData } from "../boot-data.ts";
import type { ViewDocument, WidgetItem } from "../view-document.ts";
import {
  assemble,
  type ChunkSources,
  type SnapshotSources,
  selectChunks,
  targetOf,
} from "./index.ts";
import { keptComponents } from "./kept-render.ts";

// Kept diagram renders in a Snapshot (snapshot design decision 4, Kept renders; open question B3)
// over a fixture manifest: a `probe-diagram` renderer chunk naming `probe-diagram-svg` as its
// kept-render chunk. The kept-render chunk's own rendering is the Diagram epic's.

const chunk = (name: string): ManifestChunk => {
  const found = fixtureViewManifest.chunks[name];
  if (found === undefined) throw new Error(`no fixture chunk ${name}`);
  return found;
};
const scriptOf = (name: string) =>
  `(function(){"use strict";globalThis.askboardProbe=${JSON.stringify(name)};})();\n`;
const rendererScript = scriptOf("probe-diagram");
const keptScript = scriptOf("probe-diagram-svg");
const file = (path: string, digit: string, text: string) => ({
  path,
  sha256: digit.repeat(64),
  bytes: text.length,
});
const component = (name: string, digit: string, text: string): ManifestChunk => ({
  kind: "component",
  script: file(`chunks/${name}.js`, digit, text),
  styles: [],
  needs: ["react", "shell"],
  components: [name],
  licences: [],
});

/** The fixture at manifest 1.1, ext-apps host-only, with the probe diagram's two chunks. */
const probeManifest: ViewManifest = {
  ...fixtureViewManifest,
  version: VIEW_MANIFEST_VERSION,
  chunks: {
    ...fixtureViewManifest.chunks,
    shell: { ...chunk("shell"), needs: ["react"] },
    "ext-apps": { ...chunk("ext-apps"), hostOnly: true },
    "probe-diagram": {
      ...component("probe-diagram", "d", rendererScript),
      keptRender: "probe-diagram-svg",
    },
    "probe-diagram-svg": component("probe-diagram-svg", "e", keptScript),
  },
};
const chunkSources: ChunkSources = {
  ...Object.fromEntries(
    Object.values(fixtureViewManifest.chunks).flatMap((entry) =>
      [entry.script, ...entry.styles].map((f) => [f.sha256, fixtureViewFiles[f.path] ?? ""]),
    ),
  ),
  ["d".repeat(64)]: rendererScript,
  ["e".repeat(64)]: keptScript,
};
const sources: SnapshotSources = { chunks: chunkSources, licences: fixtureViewFiles };

// A board whose question, at rev 2, holds two probe diagrams beside its options.
const flow: WidgetItem = { type: "probe-diagram", id: "flow", props: {} };
const sequence: WidgetItem = { type: "probe-diagram", id: "sequence", props: {} };
const [question] = plainChoiceBoardDocument.items;
const document: ViewDocument = {
  ...plainChoiceBoardDocument,
  items: [{ ...question, rev: 2, props: { ...question.props, items: [flow, sequence] } }],
};
const state = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 2, state: "open" }],
} as const;
const render = (itemId: string, rev = 2): SnapshotRender => ({
  itemId,
  rev,
  light: `<svg data-theme="light">${itemId}</svg>`,
  dark: `<svg data-theme="dark">${itemId}</svg>`,
});
const snapshot = (renders?: readonly SnapshotRender[]): SnapshotData => ({
  ...lifecycleSnapshotData,
  document: document as LifecycleBoardDocument,
  state,
  ...(renders === undefined ? {} : { renders }),
});
const selected = (data: SnapshotData) =>
  selectChunks(data.document, probeManifest, targetOf(data)).map(({ name }) => name);

describe("the fixture manifest", () => {
  test("validates: probe-diagram names probe-diagram-svg as its kept-render chunk", () => {
    expect(validateViewManifest(probeManifest).ok).toBe(true);
  });

  test("its check fails on a kept-render chunk the manifest lacks, naming both chunks", () => {
    const renderer = { ...probeManifest.chunks["probe-diagram"], keptRender: "probe-diagram-png" };
    const missing = {
      ...probeManifest,
      chunks: { ...probeManifest.chunks, "probe-diagram": renderer },
    };
    const checked = validateViewManifest(missing);
    expect(checked.ok ? [] : checked.problems).toEqual([
      {
        path: "/chunks/probe-diagram/keptRender",
        message:
          'the chunk "probe-diagram" names "probe-diagram-png" as its kept-render chunk, which is not in the manifest',
      },
    ]);
  });
});

describe("kept-render selection (Kept diagram renders in a Snapshot)", () => {
  test("two probe diagrams with renders select only the kept-render chunk", () => {
    const data = snapshot([render("flow"), render("sequence")]);
    expect(selected(data)).toEqual(["react", "radix", "shell", "choice", "probe-diagram-svg"]);
    const { srcdoc } = assemble(data, probeManifest, sources);
    expect(srcdoc).toContain(keptScript);
    expect(srcdoc).not.toContain(rendererScript);
  });

  test("one without a render selects both", () => {
    const data = snapshot([render("flow")]);
    expect(selected(data)).toEqual([
      "react",
      "radix",
      "shell",
      "choice",
      "probe-diagram",
      "probe-diagram-svg",
    ]);
    const { srcdoc } = assemble(data, probeManifest, sources);
    expect(srcdoc).toContain(keptScript);
    expect(srcdoc).toContain(rendererScript);
  });

  test("a render counts only for the item's current revision", () => {
    const stale = snapshot([render("flow"), render("sequence", 1)]);
    expect(selected(stale)).toContain("probe-diagram");
    expect(selected(stale)).toContain("probe-diagram-svg");
  });

  test("without renders, a Snapshot selects the renderer chunk and the kept-render chunk", () => {
    expect(selected(snapshot())).toEqual([
      "react",
      "radix",
      "shell",
      "choice",
      "probe-diagram",
      "probe-diagram-svg",
    ]);
  });

  test("a component whose chunk names no kept-render chunk keeps its chunk, renders or not", () => {
    const data = snapshot([render("database"), render("flow"), render("sequence")]);
    expect(selected(data)).toContain("choice");
  });

  test("a board's srcdoc ignores renders: it takes the renderer chunk alone", () => {
    const renders = [render("flow"), render("sequence")];
    const board = { document, state, renders } as BootData;
    expect(targetOf(board)).toEqual({ output: "board" });
    const { chunks, srcdoc } = assemble(board, probeManifest, chunkSources);
    expect(chunks).toEqual(["ext-apps", "react", "radix", "shell", "choice", "probe-diagram"]);
    expect(srcdoc).toContain(rendererScript);
    expect(srcdoc).not.toContain(keptScript);
  });
});

describe("kept renders of nested items (layouts, review U-1)", () => {
  const nested = (items: readonly unknown[]): ViewDocument =>
    ({
      ...plainChoiceBoardDocument,
      items: [{ ...question, rev: 2, props: { ...question.props, items } }],
    }) as unknown as ViewDocument;
  const inGroup = { type: "group", id: "frame", props: { title: "Frame", items: [sequence] } };

  test("a nested item without a render keeps its component's renderer chunk", () => {
    const covered = keptComponents(nested([flow, inGroup]), [render("flow")]);
    expect(covered.has("probe-diagram")).toBe(false);
  });

  test("a nested item with a render, beside a top-level one, covers the component", () => {
    const covered = keptComponents(nested([flow, inGroup]), [render("flow"), render("sequence")]);
    expect(covered.has("probe-diagram")).toBe(true);
  });
});
