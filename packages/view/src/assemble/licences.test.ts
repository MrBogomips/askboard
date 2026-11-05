import { describe, expect, test } from "bun:test";
import {
  type BoardState,
  type LicenceNotice,
  type ManifestChunk,
  SNAPSHOT_LICENCES_ELEMENT,
} from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import { BOOT_DATA_ID } from "../boot-data.ts";
import { assemble, type ChunkSources, type SelectedChunk, selectChunks } from "./index.ts";
import { jsonBlock } from "./json-block.ts";
import { licenceNotices } from "./licences.ts";

// The pieces of a Snapshot's page that need neither the gathering nor `assemble`'s own file
// (snapshot design decision 4, open question B4; view-and-widgets spec, Licence notices in a
// Snapshot): the notices of the inlined chunks, and the JSON block rule both blocks share.

const state: BoardState = {
  ask: "waiting",
  questions: [{ itemId: "database", rev: 1, state: "open" }],
};
const plainSelection = selectChunks(plainChoiceBoardDocument, fixtureViewManifest);

const notice = (pkg: string, version: string, path = `licences/${pkg}-${version}.txt`) =>
  ({ package: pkg, version, licence: "MIT", path }) satisfies LicenceNotice;

const chunkWith = (name: string, licences: LicenceNotice[]): SelectedChunk => ({
  name,
  chunk: {
    kind: "library",
    script: { path: `chunks/${name}.js`, sha256: "0".repeat(64), bytes: 1 },
    styles: [],
    needs: [],
    licences,
  } satisfies ManifestChunk,
});

/** The text between `id="<id>">` and the next `</script>`, as a reader cuts a block out. */
const cutOut = (html: string, id: string): string => {
  const start = html.indexOf(`id="${id}">`) + `id="${id}">`.length;
  return html.slice(start, html.indexOf("</script>", start));
};

describe("the licence notices of a Snapshot", () => {
  test("are those of the inlined chunks, one per package and version, sorted, with their texts", () => {
    const notices = licenceNotices(plainSelection, fixtureViewFiles);
    expect(notices.map(({ package: name, version }) => `${name}@${version}`)).toEqual([
      "@modelcontextprotocol/core@2.4.0",
      "@modelcontextprotocol/ext-apps@2.0.4",
      "radix-ui@1.8.1",
      "react@19.3.1",
      "react-dom@19.3.1",
      "scheduler@0.28.0",
      "zod@4.6.7",
    ]);
    expect(notices[3]).toEqual({
      package: "react",
      version: "19.3.1",
      licence: "MIT",
      text: "react 19.3.1: MIT. Fixture notice; the view build copies the package's licence file.\n",
    });
  });

  test("leave out the notices of chunks that are not inlined", () => {
    const notices = licenceNotices([chunkWith("react", [notice("react", "19.3.1")])], {
      "licences/react-19.3.1.txt": "react's licence",
    });
    expect(notices).toEqual([
      { package: "react", version: "19.3.1", licence: "MIT", text: "react's licence" },
    ]);
  });

  test("name a package once per version, whichever chunks list it", () => {
    const texts = {
      "licences/lib-1.0.0.txt": "one",
      "licences/lib-1.10.0.txt": "ten",
      "licences/lib-1.2.0.txt": "two",
    };
    const notices = licenceNotices(
      [
        chunkWith("b", [notice("lib", "1.2.0"), notice("lib", "1.0.0")]),
        chunkWith("a", [notice("lib", "1.10.0"), notice("lib", "1.0.0")]),
      ],
      texts,
    );
    expect(notices.map(({ version, text }) => `${version} ${text}`)).toEqual([
      "1.0.0 one",
      "1.10.0 ten",
      "1.2.0 two",
    ]);
  });

  test("the same input gives the same notices, in the same order", () => {
    const reversed = [...plainSelection].reverse();
    expect(licenceNotices(reversed, fixtureViewFiles)).toEqual(
      licenceNotices(plainSelection, fixtureViewFiles),
    );
  });

  test("a missing notice text is an error naming its file and package", () => {
    const missing = chunkWith("lib", [notice("lib", "1.0.0")]);
    expect(() => licenceNotices([missing], {})).toThrow(
      'no licence text at licences/lib-1.0.0.txt for lib 1.0.0, a notice of the chunk "lib"',
    );
    const inherited = chunkWith("lib", [notice("lib", "1.0.0", "toString")]);
    expect(() => licenceNotices([inherited], {})).toThrow("no licence text at toString");
  });
});

describe("a JSON block", () => {
  test("escapes every <, so no text can end the block or open a tag", () => {
    const hostile = { text: "</script><script>alert(1)</script><!--" };
    const block = jsonBlock(SNAPSHOT_LICENCES_ELEMENT, hostile);
    expect(block).toBe(
      '<script type="application/json" id="askboard-licences">{"text":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>\\u003c!--"}</script>',
    );
    expect(block.match(/</g)).toHaveLength(2);
    expect(JSON.parse(cutOut(block, SNAPSHOT_LICENCES_ELEMENT))).toEqual(hostile);
  });

  test("is the rule E1's board data block follows, byte for byte", () => {
    const fetched: Record<string, string> = {};
    for (const { chunk } of plainSelection) {
      for (const file of [chunk.script, ...chunk.styles]) {
        const text = fixtureViewFiles[file.path];
        if (text !== undefined) fetched[file.sha256] = text;
      }
    }
    const { srcdoc } = assemble(
      { document: plainChoiceBoardDocument, state },
      fixtureViewManifest,
      fetched satisfies ChunkSources,
    );
    expect(srcdoc).toContain(
      jsonBlock(BOOT_DATA_ID, { document: plainChoiceBoardDocument, state }),
    );
  });
});
