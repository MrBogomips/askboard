import { describe, expect, test } from "bun:test";
import {
  type BoardArea,
  type LifecycleBoardDocument,
  SNAPSHOT_LICENCES_ELEMENT,
  type SnapshotData,
  type ViewManifest,
} from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  lifecycleSnapshotData,
} from "@askboard/contract/fixtures";
import { validateSnapshotData } from "@askboard/contract/validate";
import { BOOT_DATA_ID } from "../boot-data.ts";
import {
  assemble,
  type ChunkSources,
  type SnapshotSources,
  selectChunks,
  targetOf,
} from "./index.ts";
import { jsonBlock } from "./json-block.ts";
import { licenceNotices } from "./licences.ts";

// `assemble` building a Snapshot (snapshot design decision 4; view-and-widgets spec, Assembling a
// Snapshot, Licence notices in a Snapshot): the Snapshot data whole in the `askboard-data` block,
// the chunks the board's document needs, then the `askboard-licences` block last.

// The fixture build's files by SHA-256, as the board page fetches them, and its notice texts by path.
const chunkSources = (manifest: ViewManifest): ChunkSources => {
  const texts: Record<string, string> = {};
  for (const chunk of Object.values(manifest.chunks)) {
    for (const file of [chunk.script, ...chunk.styles]) {
      const text = fixtureViewFiles[file.path];
      if (text !== undefined) texts[file.sha256] = text;
    }
  }
  return texts;
};
const sources: SnapshotSources = {
  chunks: chunkSources(fixtureViewManifest),
  licences: fixtureViewFiles,
};
const data = lifecycleSnapshotData;

/** The text between `id="<id>">` and the next `</script>`, as a reader cuts a block out. */
const cutOut = (html: string, id: string): string => {
  const start = html.indexOf(`id="${id}">`) + `id="${id}">`.length;
  return html.slice(start, html.indexOf("</script>", start));
};

// The data with the first question's text replaced.
const withText = (text: string): SnapshotData => {
  const [scope, ...areas] = data.document.items as readonly [BoardArea, ...BoardArea[]];
  const [first, ...questions] = scope.props.items;
  const document: LifecycleBoardDocument = {
    ...data.document,
    items: [
      {
        ...scope,
        props: {
          ...scope.props,
          items: [{ ...first, props: { ...first.props, text } }, ...questions],
        },
      },
      ...areas,
    ],
  };
  return { ...data, document };
};

describe("a Snapshot's data block (Assembling a Snapshot)", () => {
  test("cut out by the text rule, it is the Snapshot data whole, and validates against snapshot-data", () => {
    const { srcdoc } = assemble(data, fixtureViewManifest, sources);
    const parsed: unknown = JSON.parse(cutOut(srcdoc, BOOT_DATA_ID));
    expect(parsed).toEqual(data);
    expect(validateSnapshotData(parsed)).toEqual({ ok: true, value: data });
    expect(srcdoc).toContain(jsonBlock(BOOT_DATA_ID, data));
  });

  test("a question text that closes a script is only in the data block, escaped", () => {
    const hostile = "</script><script>alert(1)</script>";
    const snapshot = withText(hostile);
    const { srcdoc, chunks } = assemble(snapshot, fixtureViewManifest, sources);
    const block = cutOut(srcdoc, BOOT_DATA_ID);
    expect(srcdoc).not.toContain(hostile);
    expect(block).toContain("\\u003c/script>\\u003cscript>alert(1)\\u003c/script>");
    expect(srcdoc.replace(block, "")).not.toContain("alert(1)");
    expect(JSON.parse(block)).toEqual(snapshot);
    // One end tag per inlined chunk, and one for each JSON block: no other script ends.
    expect(srcdoc.match(/<\/script>/g)).toHaveLength(chunks.length + 2);
  });
});

describe("a Snapshot's page (design decision 4's order)", () => {
  test("charset, policy, data block, styles, root, scripts, then the licence notices last", () => {
    const { srcdoc, policy } = assemble(data, fixtureViewManifest, sources);
    const at = (text: string) => srcdoc.indexOf(text);
    const order = [
      '<meta charset="utf-8">',
      `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
      `id="${BOOT_DATA_ID}"`,
      "<style>",
      '<div id="root"></div>',
      "<script>",
      `id="${SNAPSHOT_LICENCES_ELEMENT}"`,
    ];
    const places = order.map(at);
    expect(places.every((place) => place !== -1)).toBe(true);
    expect([...places].sort((a, b) => a - b)).toEqual(places);
    expect(srcdoc.lastIndexOf("<script>")).toBeLessThan(at(`id="${SNAPSHOT_LICENCES_ELEMENT}"`));
    const licences = cutOut(srcdoc, SNAPSHOT_LICENCES_ELEMENT);
    expect(srcdoc).toEndWith(
      `<script type="application/json" id="${SNAPSHOT_LICENCES_ELEMENT}">${licences}</script>\n</body>\n</html>\n`,
    );
  });

  test("the same input gives the same bytes, whatever the order of the sources", () => {
    const first = assemble(data, fixtureViewManifest, sources);
    const reversed: SnapshotSources = {
      chunks: Object.fromEntries(Object.entries(sources.chunks).reverse()),
      licences: Object.fromEntries(Object.entries(sources.licences).reverse()),
    };
    expect(assemble(data, fixtureViewManifest, sources)).toEqual(first);
    expect(assemble(data, fixtureViewManifest, reversed).srcdoc).toBe(first.srcdoc);
  });

  test("the data decides: without a snapshot record, the same document is a board's srcdoc", () => {
    const { document, state } = data;
    const board = assemble({ document, state }, fixtureViewManifest, sources.chunks);
    expect(board.srcdoc).not.toContain(SNAPSHOT_LICENCES_ELEMENT);
    expect(JSON.parse(cutOut(board.srcdoc, BOOT_DATA_ID))).toEqual({ document, state });
  });
});

describe("a Snapshot's licence notices (Licence notices in a Snapshot)", () => {
  test("are the manifest's for the inlined chunks, one per package and version, with their texts", () => {
    const { srcdoc, chunks } = assemble(data, fixtureViewManifest, sources);
    const notices = JSON.parse(cutOut(srcdoc, SNAPSHOT_LICENCES_ELEMENT)) as {
      package: string;
      version: string;
      licence: string;
      text: string;
    }[];
    const listed = new Set(
      chunks.flatMap((name) =>
        (fixtureViewManifest.chunks[name]?.licences ?? []).map(
          (notice) => `${notice.package}@${notice.version}`,
        ),
      ),
    );
    expect(notices.map((notice) => `${notice.package}@${notice.version}`).sort()).toEqual(
      [...listed].sort(),
    );
    expect(notices).toEqual([
      ...licenceNotices(
        selectChunks(data.document, fixtureViewManifest, targetOf(data)),
        fixtureViewFiles,
      ),
    ]);
    const react = notices.find((notice) => notice.package === "react");
    expect(react?.text).toBe(fixtureViewFiles["licences/react-19.3.1.txt"]);
  });

  test("a missing notice text is an error naming its file and package", () => {
    const { "licences/react-19.3.1.txt": _, ...licences } = fixtureViewFiles;
    expect(() => assemble(data, fixtureViewManifest, { ...sources, licences })).toThrow(
      "no licence text at licences/react-19.3.1.txt for react 19.3.1",
    );
  });

  test("Snapshot sources without the notice texts are an error", () => {
    const bare = sources.chunks as unknown as SnapshotSources;
    expect(() => assemble(data, fixtureViewManifest, bare)).toThrow("sources.licences");
  });
});

describe("the Snapshot's modules are pure ECMAScript (AD-9: snapshot calls assemble too)", () => {
  test("they import only the contract and each other", async () => {
    const transpiler = new Bun.Transpiler({ loader: "ts" });
    for (const path of ["json-block.ts", "licences.ts"]) {
      const source = await Bun.file(`${import.meta.dir}/${path}`).text();
      for (const { path: specifier } of transpiler.scanImports(source)) {
        expect([path, specifier === "@askboard/contract" || specifier.startsWith(".")]).toEqual([
          path,
          true,
        ]);
      }
    }
  });
});
