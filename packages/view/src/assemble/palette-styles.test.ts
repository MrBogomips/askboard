import { describe, expect, test } from "bun:test";
import { PALETTES, type SnapshotData, type ViewManifest } from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  lifecycleSnapshotData,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import type { BootData } from "../boot-data.ts";
import { paletteStylePath } from "../palettes.ts";
import { assemble, type ChunkSources, selectChunks, sourcesToFetch, targetOf } from "./index.ts";

// Palette sheets in the shell's styles (palettes, task 2.4, design decision D4): a board keeps
// every file, a Snapshot the shell's own and its record's palette's, and the view's policy hashes
// exactly the styles inlined.

const NAMED = PALETTES.filter((name) => name !== "carta");
const text = (name: string) =>
  `:root[data-palette="${name}"]{--background:#${name.length}${name.length}${name.length};}\n`;
const sha = (index: number) => String(index).repeat(64).slice(0, 64);

const shell = fixtureViewManifest.chunks.shell;
if (shell === undefined) throw new Error("the fixture manifest has no shell");

const withPalettes: ViewManifest = {
  ...fixtureViewManifest,
  chunks: {
    ...fixtureViewManifest.chunks,
    shell: {
      ...shell,
      styles: [
        ...shell.styles,
        ...NAMED.map((name, at) => ({
          path: paletteStylePath(name),
          sha256: sha(at + 1),
          bytes: text(name).length,
        })),
      ],
    },
  },
};

const files: Record<string, string> = {
  ...fixtureViewFiles,
  ...Object.fromEntries(NAMED.map((name) => [paletteStylePath(name), text(name)])),
};
const sources: ChunkSources = (() => {
  const texts: Record<string, string> = {};
  for (const chunk of Object.values(withPalettes.chunks)) {
    for (const file of [chunk.script, ...chunk.styles]) {
      const body = files[file.path];
      if (body !== undefined) texts[file.sha256] = body;
    }
  }
  return texts;
})();
const snapshotSources = { chunks: sources, licences: fixtureViewFiles };

const withPalette = (palette: unknown): SnapshotData => ({
  ...lifecycleSnapshotData,
  snapshot: {
    ...lifecycleSnapshotData.snapshot,
    presentation: { theme: "dark", density: "compact", palette },
  } as SnapshotData["snapshot"],
});

const styleTexts = (srcdoc: string) =>
  [...srcdoc.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((match) => match[1]);
const hashesOf = (policy: string) =>
  (/style-src ([^;]*)/.exec(policy)?.[1] ?? "").split(" ").filter((part) => part.length > 0);

describe("a board", () => {
  const data: BootData = {
    document: plainChoiceBoardDocument,
    state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
  } as BootData;

  test("keeps the three palette sheets with the shell's own, and fetches each", () => {
    const { srcdoc } = assemble(data, withPalettes, sources);
    const styles = styleTexts(srcdoc);
    for (const name of NAMED) expect(styles).toContain(text(name));
    const paths = sourcesToFetch(selectChunks(data.document, withPalettes)).map((f) => f.path);
    for (const name of NAMED) expect(paths).toContain(paletteStylePath(name));
  });

  test("targets a board: no palette in its selection target", () => {
    expect(targetOf(data)).toEqual({ output: "board" });
  });
});

describe("a Snapshot", () => {
  test.each(NAMED)("recording %s inlines the shell's styles and that sheet only", (name) => {
    const { srcdoc } = assemble(withPalette(name), withPalettes, snapshotSources);
    const styles = styleTexts(srcdoc);
    expect(styles).toContain(text(name));
    for (const other of NAMED.filter((candidate) => candidate !== name)) {
      expect(styles).not.toContain(text(other));
      expect(srcdoc).not.toContain(`data-palette="${other}"`);
    }
    expect(styles).toContain(fixtureViewFiles["chunks/shell.css"]);
  });

  test.each([["carta"], [undefined], ["inchiostro"], [3]])(
    "recording %p inlines no palette sheet: Carta's is the shell's own",
    (palette) => {
      const { srcdoc } = assemble(withPalette(palette), withPalettes, snapshotSources);
      for (const name of NAMED) expect(srcdoc).not.toContain(`data-palette="${name}"`);
    },
  );

  test("a record with no presentation inlines no palette sheet", () => {
    const { snapshot, ...rest } = lifecycleSnapshotData;
    const bare = {
      ...rest,
      snapshot: { takenAt: snapshot.takenAt, takenBy: "agent" },
    } as SnapshotData;
    const { srcdoc } = assemble(bare, withPalettes, snapshotSources);
    for (const name of NAMED) expect(srcdoc).not.toContain(`data-palette="${name}"`);
  });

  test("the policy hashes exactly the styles inlined, and none of the sheets left out", () => {
    for (const palette of [...NAMED, "carta"]) {
      const data = withPalette(palette);
      const { srcdoc, policy } = assemble(data, withPalettes, snapshotSources);
      const selected = selectChunks(data.document, withPalettes, targetOf(data));
      const expected = selected.flatMap(({ chunk }) => chunk.styles.map((s) => s.sha256));
      expect(styleTexts(srcdoc)).toHaveLength(expected.length);
      expect(hashesOf(policy)).toHaveLength(expected.length);
      for (const [at, name] of NAMED.entries()) {
        const listed = expected.includes(sha(at + 1));
        expect(listed).toBe(name === palette);
      }
    }
  });

  test("the fetch list of a Snapshot's selection names the shell's sheets and its palette's alone", () => {
    const data = withPalette("grafite");
    const paths = sourcesToFetch(selectChunks(data.document, withPalettes, targetOf(data))).map(
      (file) => file.path,
    );
    expect(paths).toContain(paletteStylePath("grafite"));
    expect(paths).not.toContain(paletteStylePath("nordico"));
    expect(paths).not.toContain(paletteStylePath("contrasto"));
  });

  test("the selection target names the palette: the record's when listed, else carta", () => {
    expect(targetOf(withPalette("nordico"))).toMatchObject({
      output: "snapshot",
      palette: "nordico",
    });
    expect(targetOf(withPalette("inchiostro"))).toMatchObject({ palette: "carta" });
    expect(targetOf(withPalette(undefined))).toMatchObject({ palette: "carta" });
  });
});
