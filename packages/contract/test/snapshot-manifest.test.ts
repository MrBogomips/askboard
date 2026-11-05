import { describe, expect, test } from "bun:test";
import { fixtureViewManifest } from "../src/fixtures/index.ts";
import { type ManifestChunk, VIEW_MANIFEST_VERSION, viewManifestSet } from "../src/index.ts";
import { type Checked, validateViewManifest } from "../src/validate.ts";

// The view manifest's next minor (snapshot task 1.4; contract spec, Host-only and kept-render
// chunks): `hostOnly` on a chunk needed only with a parent host, and `keptRender` on a component
// chunk naming the chunk that shows its kept renders.

type Json = Record<string, unknown>;
const problems = (checked: Checked<unknown>) => (checked.ok ? [] : checked.problems);
const paths = (value: unknown) => problems(validateViewManifest(value)).map(({ path }) => path);

const { chunks } = fixtureViewManifest;
const extApps = chunks["ext-apps"] as ManifestChunk;
const choice = chunks.choice as ManifestChunk;
const file = (path: string, digit: string) => ({ path, sha256: digit.repeat(64), bytes: 10 });

/** The fixture at this minor, with ext-apps host-only and the probe diagram's two chunks. */
const manifest = (probe: Json = {}): Json => ({
  ...fixtureViewManifest,
  version: VIEW_MANIFEST_VERSION,
  chunks: {
    ...chunks,
    "ext-apps": { ...extApps, hostOnly: true },
    "probe-diagram": {
      ...choice,
      script: file("chunks/probe-diagram.js", "a"),
      styles: [],
      components: ["probe-diagram"],
      keptRender: "probe-diagram-svg",
      ...probe,
    },
    "probe-diagram-svg": {
      ...choice,
      script: file("chunks/probe-diagram-svg.js", "b"),
      styles: [],
      components: ["probe-diagram-svg"],
    },
  },
});

describe("the view manifest's next minor", () => {
  test("is 1.1, the set's version", () => {
    expect(VIEW_MANIFEST_VERSION).toBe("1.1");
    expect(viewManifestSet.version).toBe(VIEW_MANIFEST_VERSION);
  });

  test("E1's manifest fixture, at 1.0, still validates", () => {
    expect(fixtureViewManifest.version).toBe("1.0");
    expect(validateViewManifest(fixtureViewManifest)).toEqual({
      ok: true,
      value: fixtureViewManifest,
    });
  });
});

describe("host-only chunks", () => {
  test("a manifest whose ext-apps chunk carries hostOnly: true validates", () => {
    const hostOnly = {
      ...fixtureViewManifest,
      chunks: { ...chunks, "ext-apps": { ...extApps, hostOnly: true } },
    };
    expect(paths(hostOnly)).toEqual([]);
  });

  test("hostOnly is only ever true", () => {
    const flagged = {
      ...fixtureViewManifest,
      chunks: { ...chunks, "ext-apps": { ...extApps, hostOnly: false } },
    };
    expect(paths(flagged)).toEqual(["/chunks/ext-apps/hostOnly"]);
  });
});

describe("kept-render chunks", () => {
  test("a component chunk naming a listed chunk as its kept-render chunk validates", () => {
    expect(paths(manifest())).toEqual([]);
  });

  test("a kept-render chunk the manifest does not list fails, naming both chunks", () => {
    const missing = manifest({ keptRender: "probe-diagram-png" });
    expect(problems(validateViewManifest(missing))).toEqual([
      {
        path: "/chunks/probe-diagram/keptRender",
        message:
          'the chunk "probe-diagram" names "probe-diagram-png" as its kept-render chunk, which is not in the manifest',
      },
    ]);
  });

  test("only a component chunk names a kept-render chunk", () => {
    const library = manifest();
    const react = (library.chunks as Json).react as Json;
    (library.chunks as Json).react = { ...react, keptRender: "probe-diagram-svg" };
    expect(problems(validateViewManifest(library))).toEqual([
      {
        path: "/chunks/react/keptRender",
        message: "only a component chunk names a kept-render chunk",
      },
    ]);
  });

  test("a kept-render name that is no chunk name fails at its field", () => {
    expect(paths(manifest({ keptRender: "Probe Diagram" }))).toEqual([
      "/chunks/probe-diagram/keptRender",
    ]);
  });
});
