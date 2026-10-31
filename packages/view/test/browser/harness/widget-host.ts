// The widget host (design decision 9 of the tree-widget change): test code that hosts a view built
// from any board document, a question with widget items included, which the real board page
// refuses (fail closed). A `Bun.serve` on 127.0.0.1, port 0, serves one page, at `/`, under the
// board page's policy with the host script's hash in place of the board page's, so the view's
// srcdoc, which inherits that policy, is admitted by its chunks' hashes as on the board page
// (AD-8). The page holds the board page's styles, the srcdoc assembled from the build with
// `assemble` and the open state in a JSON data block, and the host script
// (`fixtures/widget-host-page.ts`), which hosts the view with the board page's own `hostView`.
// Everything else answers 404.

import { join } from "node:path";
import { BOARD_HOST, BOARD_RESPONSES, boardPagePolicy } from "@askboard/contract";
import type { ViewDocument } from "../../../src/view-document.ts";
import { WIDGET_HOST_DATA_ID, type WidgetHostData } from "../fixtures/widget-host-data.ts";
import { type HttpAnswer, toResponse } from "./http.ts";
import {
  assembledSrcdoc,
  bundleTestChunk,
  EVAL_PROBE,
  openStateOf,
  sha256Hex,
  type ViewBuild,
} from "./view-build.ts";

export type WidgetHost = {
  /** The host page's URL. */
  readonly url: string;
  close(): Promise<void>;
};

export type WidgetHostOptions = {
  /** The host page runs `EVAL_PROBE` first: a negative control for the violation collector. */
  readonly probe?: boolean;
};

const PAGE_ENTRY = join(import.meta.dir, "..", "fixtures", "widget-host-page.ts");

// Bundled once per process: every test's page runs the same script.
let bundled: Promise<string> | undefined;

// The script as it sits inline: nothing in it may end the element or open a comment there.
const hostScript = async (probe: boolean): Promise<string> => {
  bundled ??= bundleTestChunk(PAGE_ENTRY);
  const script = `${probe ? EVAL_PROBE : ""}${await bundled}`;
  if (/<\/script|<!--/i.test(script)) {
    throw new Error("the widget host's script cannot sit inline: it holds </script or <!--");
  }
  return script;
};

/** The board page's policy with the host script's hash in place of the board page's script's. */
const policyOf = (build: ViewBuild, script: string): string =>
  boardPagePolicy({
    ...build.manifest,
    boardPage: {
      ...build.manifest.boardPage,
      script: {
        path: "widget-host.js",
        sha256: sha256Hex(script),
        bytes: Buffer.byteLength(script),
      },
    },
  });

/** The data as JSON with every `<` escaped, as `assemble` writes the view's own data block. */
const dataBlock = (data: WidgetHostData): string => JSON.stringify(data).replaceAll("<", "\\u003c");

const pageOf = (build: ViewBuild, script: string, data: WidgetHostData): string => {
  const styles = build.manifest.boardPage.styles.map(
    (style) => `<style>${build.files.get(style.path) ?? ""}</style>`,
  );
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    // Keeps Firefox from requesting /favicon.ico, which `img-src` refuses (board-page.ts).
    '<link rel="icon" href="data:,">',
    "<title>AskBoard widget host</title>",
    ...styles,
    `<script type="application/json" id="${WIDGET_HOST_DATA_ID}">${dataBlock(data)}</script>`,
    "</head>",
    "<body>",
    `<script>${script}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
};

const notFound = (): HttpAnswer => ({
  status: BOARD_RESPONSES.notFound.status,
  headers: { "Content-Type": BOARD_RESPONSES.notFound.contentType },
  body: "Not found.\n",
});

// The one page at `/`, for GET and HEAD; nothing else.
const answer = (request: Request, html: string, policy: string): HttpAnswer => {
  const { pathname } = new URL(request.url);
  if (pathname !== "/" || (request.method !== "GET" && request.method !== "HEAD")) {
    return notFound();
  }
  return {
    status: BOARD_RESPONSES.boardPage.status,
    headers: {
      "Content-Type": BOARD_RESPONSES.boardPage.contentType,
      "Content-Security-Policy": policy,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
    body: html,
  };
};

/** Serves the host page for a board document, its question open, with the view from `build`. */
export const startWidgetHost = async (
  build: ViewBuild,
  document: ViewDocument,
  options: WidgetHostOptions = {},
): Promise<WidgetHost> => {
  const script = await hostScript(options.probe === true);
  const data: WidgetHostData = {
    srcdoc: assembledSrcdoc(build, document),
    state: openStateOf(document),
  };
  const html = pageOf(build, script, data);
  const policy = policyOf(build, script);
  const server = Bun.serve({
    hostname: BOARD_HOST,
    port: 0,
    fetch: (request) => toResponse(answer(request, html, policy), request.method),
  });
  return {
    url: `http://${BOARD_HOST}:${server.port}/`,
    close: () => server.stop(true),
  };
};
