import { describe, expect, test } from "bun:test";
import { BOARD_TOKEN_HEADER, type ViewManifest } from "@askboard/contract";
import {
  fixtureViewFiles,
  fixtureViewManifest,
  plainChoiceBoardDocument,
} from "@askboard/contract/fixtures";
import { sourceHash } from "../chunk-integrity.ts";
import { createViewLoader, type FetchText } from "./load-view.ts";

const initial = {
  document: plainChoiceBoardDocument,
  state: { ask: "waiting", questions: [{ itemId: "database", rev: 1, state: "open" }] },
} as const;
const documentWithChart = {
  ...plainChoiceBoardDocument,
  items: [
    {
      ...plainChoiceBoardDocument.items[0],
      props: {
        ...plainChoiceBoardDocument.items[0].props,
        items: [{ type: "chart", id: "chart", props: {} }],
      },
    },
  ],
} as never;

const setup = async () => {
  const script = "globalThis.chartLoaded = true;";
  const sha256 = await sourceHash(script);
  const manifest: ViewManifest = {
    ...fixtureViewManifest,
    chunks: {
      ...fixtureViewManifest.chunks,
      chart: {
        kind: "component",
        components: ["chart"],
        script: { path: "chunks/chart.js", bytes: script.length, sha256 },
        styles: [],
        needs: ["react"],
        licences: [],
      },
    },
  };
  const files = new Map(
    Object.values(manifest.chunks)
      .flatMap((chunk) => [chunk.script, ...chunk.styles])
      .map((file) => [file.sha256, fixtureViewFiles[file.path] ?? script]),
  );
  const requests: string[] = [];
  let corrupted = false;
  const get: FetchText = async (url, headers) => {
    expect(headers[BOARD_TOKEN_HEADER]).toBe("token");
    requests.push(url);
    if (url === "/m") return { status: 200, text: JSON.stringify(manifest) };
    const text = files.get(url.slice(3));
    return {
      status: text === undefined ? 404 : 200,
      text: corrupted && url.endsWith(sha256) ? script.replace("true", "null") : (text ?? ""),
    };
  };
  return {
    loader: createViewLoader("token", get),
    script,
    sha256,
    requests,
    corrupt: (value: boolean) => {
      corrupted = value;
    },
  };
};

describe("components introduced after the view boots", () => {
  test("fetches and returns only the new chunks, and authorizes their exact hashes at boot", async () => {
    const { loader, script, sha256, requests } = await setup();
    const assembled = await loader.load(initial);
    expect(assembled.srcdoc).not.toContain(script);
    const chunks = await loader.additions(documentWithChart);
    expect(chunks).toEqual([{ name: "chart", script: { text: script, sha256 }, styles: [] }]);
    expect(assembled.policy).toContain(Buffer.from(sha256, "hex").toString("base64"));
    expect(await loader.additions(documentWithChart)).toEqual([]);
    expect(requests.filter((url) => url.endsWith(sha256))).toHaveLength(1);
    expect(requests.filter((url) => url === "/m")).toHaveLength(1);
  });

  test("a corrupt chunk is refused and can be retried without losing the existing view", async () => {
    const run = await setup();
    await run.loader.load(initial);
    run.corrupt(true);
    await expect(run.loader.additions(documentWithChart)).rejects.toThrow("hash");
    run.corrupt(false);
    expect(await run.loader.additions(documentWithChart)).toHaveLength(1);
  });
});
