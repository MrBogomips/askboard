// What the widget host's browser tests share (design decision 9 of the tree-widget change), as
// `board-test.ts` is for the board page's: one browser per engine for the file, and per test a
// widget host and a browser context, closed after the test, also when it fails. The context is
// E1's `BoardContext`, so the CSP collector covers the host page, the view and the console; the
// host page's binding records every view message for the test.

import { afterAll, afterEach, beforeAll } from "bun:test";
import type { Browser } from "playwright";
import type { ViewDocument } from "../../../src/view-document.ts";
import type { ViewMessage } from "../../../src/view-protocol.ts";
import { WIDGET_HOST_BINDING } from "../fixtures/widget-host-data.ts";
import { type Closable, closeAll } from "./board-test.ts";
import { BoardContext, launchEngine } from "./browser.ts";
import { type Board, boardOf } from "./dom.ts";
import type { Engine } from "./engines.ts";
import type { ViewBuild } from "./view-build.ts";
import { startWidgetHost, type WidgetHostOptions } from "./widget-host.ts";

export type WidgetHostRun = {
  /** The host page, its view's frame found as on the board page. */
  readonly board: Board;
  readonly browser: BoardContext;
  /** Every view message the host page passed on, in order. */
  readonly messages: readonly ViewMessage[];
};

/** The tests of one engine: launches its browser for the file and cleans up after each test. */
export const useWidgetHost = (engine: Engine) => {
  let browser: Browser | undefined;
  const open: Closable[] = [];
  beforeAll(async () => {
    browser = await launchEngine(engine);
  });
  afterEach(async () => {
    await closeAll(open.splice(0));
  });
  afterAll(async () => {
    await browser?.close();
  });
  /** A new tab on a widget host for the document, its question open, with the view from `build`. */
  const host = async (
    build: ViewBuild,
    document: ViewDocument,
    options?: WidgetHostOptions,
  ): Promise<WidgetHostRun> => {
    if (browser === undefined) throw new Error(`${engine} did not launch`);
    const server = await startWidgetHost(build, document, options);
    open.push(server);
    const context = await BoardContext.open(browser);
    open.push(context);
    const messages: ViewMessage[] = [];
    await context.context.exposeBinding(WIDGET_HOST_BINDING, (_source, message: ViewMessage) => {
      messages.push(message);
    });
    const page = await context.newTab(server.url);
    return { board: boardOf(page), browser: context, messages };
  };
  return { host };
};
