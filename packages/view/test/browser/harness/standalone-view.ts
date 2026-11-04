// A view with no parent host, as a Snapshot opens it (excerpts, task 6.4; AD-9): the assembled
// document served as the tab's own page, which carries its policy as a meta tag. Nothing hosts it,
// so it follows the system colour scheme and sends no message. Test code only; E7's Snapshot
// writes the same document.

import { BOARD_HOST } from "@askboard/contract";
import type { ViewDocument } from "../../../src/view-document.ts";
import { assembledSrcdoc, type ViewBuild } from "./view-build.ts";

export type StandaloneView = {
  /** The page's URL. */
  readonly url: string;
  /** The URL of every request the server saw, as `METHOD /path`. */
  readonly requests: readonly string[];
  close(): Promise<void>;
};

/** Serves the view for a board document at `/`; everything else answers 404. */
export const startStandaloneView = (build: ViewBuild, document: ViewDocument): StandaloneView => {
  const html = assembledSrcdoc(build, document);
  const requests: string[] = [];
  const server = Bun.serve({
    hostname: BOARD_HOST,
    port: 0,
    fetch: (request) => {
      const { pathname } = new URL(request.url);
      requests.push(`${request.method} ${pathname}`);
      if (pathname !== "/") return new Response("Not found.\n", { status: 404 });
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Referrer-Policy": "no-referrer" },
      });
    },
  });
  return {
    url: `http://${BOARD_HOST}:${server.port}/`,
    requests,
    close: () => server.stop(true),
  };
};
