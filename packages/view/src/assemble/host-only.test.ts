import { describe, expect, test } from "bun:test";
import {
  cspHashSource,
  type ManifestChunk,
  type SnapshotData,
  VIEW_MANIFEST_VERSION,
  type ViewManifest,
} from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  lifecycleSnapshotData,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import {
  assemble,
  type ChunkSources,
  FOR_BOARD,
  type SnapshotSources,
  selectChunks,
  targetOf,
} from "./index.ts";

// Host-only chunks (snapshot design decision 5; view-and-widgets spec, No view-protocol code in a
// Snapshot): the ext-apps chunk is loaded only by a view with a host. A board's selection adds it
// as a root; a Snapshot's leaves it out, and refuses a chunk that needs it.

const chunk = (name: string): ManifestChunk => {
  const found = fixtureViewManifest.chunks[name];
  if (found === undefined) throw new Error(`no fixture chunk ${name}`);
  return found;
};

/** The fixture as the view build writes it since manifest 1.1: ext-apps host-only, the shell lazy. */
const hostOnly: ViewManifest = {
  ...fixtureViewManifest,
  version: VIEW_MANIFEST_VERSION,
  chunks: {
    ...fixtureViewManifest.chunks,
    shell: { ...chunk("shell"), needs: ["react"] },
    "ext-apps": { ...chunk("ext-apps"), hostOnly: true },
  },
};

const chunkSources: ChunkSources = Object.fromEntries(
  Object.values(fixtureViewManifest.chunks).flatMap((entry) =>
    [entry.script, ...entry.styles].map((file) => [file.sha256, fixtureViewFiles[file.path] ?? ""]),
  ),
);
const sources: SnapshotSources = { chunks: chunkSources, licences: fixtureViewFiles };

// A plain-question Snapshot: the lifecycle Snapshot's record over E1's plain Choice board.
const plain: SnapshotData = {
  ...lifecycleSnapshotData,
  document: plainChoiceBoardDocument,
  state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
};
const names = (target = FOR_BOARD) =>
  selectChunks(plainChoiceBoardDocument, hostOnly, target).map(({ name }) => name);

describe("the selection's host-only chunks (design decision 4, Selection)", () => {
  test("a board takes every host-only chunk as a root, in its place among the libraries", () => {
    expect(names()).toEqual(["ext-apps", "react", "radix", "shell", "choice"]);
    expect(targetOf({ document: plain.document, state: plain.state })).toEqual(FOR_BOARD);
  });

  test("a Snapshot takes none", () => {
    expect(targetOf(plain)).toEqual({ output: "snapshot", renders: [] });
    expect(names(targetOf(plain))).toEqual(["react", "radix", "shell", "choice"]);
  });

  test("a Snapshot whose chunk needs a host-only chunk fails, naming both", () => {
    const needing: ViewManifest = {
      ...hostOnly,
      chunks: { ...hostOnly.chunks, shell: chunk("shell") },
    };
    expect(() => selectChunks(plainChoiceBoardDocument, needing, targetOf(plain))).toThrow(
      'the chunk "shell" needs the host-only chunk "ext-apps", which a Snapshot leaves out',
    );
    // A board loads it: its view has the host the chunk needs.
    expect(selectChunks(plainChoiceBoardDocument, needing).map(({ name }) => name)).toContain(
      "ext-apps",
    );
  });
});

describe("a board and its Snapshot (No view-protocol code in a Snapshot)", () => {
  const extApps = chunk("ext-apps");
  const code = fixtureViewFiles[extApps.script.path] ?? "";
  const board = assemble({ document: plain.document, state: plain.state }, hostOnly, chunkSources);
  const snapshot = assemble(plain, hostOnly, sources);

  test("the board's srcdoc holds the ext-apps chunk and the Snapshot does not", () => {
    expect(board.chunks).toContain("ext-apps");
    expect(board.srcdoc).toContain(code);
    expect(board.policy).toContain(cspHashSource(extApps.script.sha256));
    expect(snapshot.chunks).toEqual(["react", "radix", "shell", "choice"]);
    expect(snapshot.srcdoc).not.toContain(code);
    expect(snapshot.policy).not.toContain(cspHashSource(extApps.script.sha256));
  });

  test("the Snapshot's notices are its chunks', React's included, and none only ext-apps carries", () => {
    const block = /id="askboard-licences">([\s\S]*?)<\/script>/.exec(snapshot.srcdoc)?.[1] ?? "";
    const packages = (JSON.parse(block) as { package: string }[]).map((notice) => notice.package);
    expect(packages).toEqual(["radix-ui", "react", "react-dom", "scheduler"]);
    for (const notice of extApps.licences) expect(packages).not.toContain(notice.package);
  });
});
