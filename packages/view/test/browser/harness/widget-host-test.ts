// What the widget host's browser tests share (design decision 9 of the tree-widget change), as
// `board-test.ts` is for the board page's: one browser per engine for the file, and per test a
// widget host and a browser context, closed after the test, also when it fails. The context is
// E1's `BoardContext`, in the system colour scheme the test asks for, so the CSP collector covers
// the host page, the view and the console; the host page's binding records every view message for
// the test, and the test sends the view a later update, a lock for one, as the board page would.

import { afterAll, afterEach, beforeAll } from "bun:test";
import type { Browser } from "playwright";
import type { ViewDocument } from "../../../src/view-document.ts";
import type { ViewMessage, ViewUpdate } from "../../../src/view-protocol.ts";
import { WIDGET_HOST_BINDING, WIDGET_HOST_UPDATE } from "../fixtures/widget-host-data.ts";
import { type Closable, closeAll } from "./board-test.ts";
import { BoardContext, type BoardContextOptions, launchEngine } from "./browser.ts";
import { type Board, boardOf } from "./dom.ts";
import type { Engine } from "./engines.ts";
import type { ViewBuild } from "./view-build.ts";
import { startWidgetHost, type WidgetHostOptions } from "./widget-host.ts";

export type WidgetHostRun = {
  /** The host page, its view's frame found as on the board page. */
  readonly board: Board;
  readonly browser: BoardContext;
  /**
   * Every view message the host page passed on, in order, but the draft mirror and the activity:
   * since the ask lifecycle the view mirrors its draft record to the board page after each edit
   * (AD-20), which reaches no agent, so it is kept apart in `drafts`; since push delivery the view
   * reports the user's keys and pointer for the board's working signal (design decision 10), which
   * reaches no agent either, so it is kept apart in `activity`.
   */
  readonly messages: readonly ViewMessage[];
  /** The draft records the view mirrored, in order (ask-lifecycle, task 6.1). */
  readonly drafts: readonly ViewMessage[];
  /** The activity messages the view sent (push delivery). */
  readonly activity: readonly ViewMessage[];
  /** Sends the view a later update, as the board page sends each new state or lock. */
  update(update: ViewUpdate): Promise<void>;
};

// Runs in the host page: hands the update to the function the page set, once it has hosted the view.
const sendUpdate = ([name, update]: readonly [string, ViewUpdate]): boolean => {
  const send = (globalThis as unknown as Record<string, unknown>)[name];
  if (typeof send !== "function") return false;
  send(update);
  return true;
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
  /**
   * A new tab on a widget host for the document, its question open, with the view from `build`, in
   * the light system colour scheme unless `colorScheme` says otherwise.
   */
  const host = async (
    build: ViewBuild,
    document: ViewDocument,
    options: WidgetHostOptions & BoardContextOptions = {},
  ): Promise<WidgetHostRun> => {
    if (browser === undefined) throw new Error(`${engine} did not launch`);
    const server = await startWidgetHost(build, document, options);
    open.push(server);
    const context = await BoardContext.open(browser, options);
    open.push(context);
    const messages: ViewMessage[] = [];
    const drafts: ViewMessage[] = [];
    const activity: ViewMessage[] = [];
    await context.context.exposeBinding(WIDGET_HOST_BINDING, (_source, message: ViewMessage) => {
      if (message.type === "draft") drafts.push(message);
      else if (message.type === "activity") activity.push(message);
      else messages.push(message);
    });
    const page = await context.newTab(server.url);
    const update = async (next: ViewUpdate): Promise<void> => {
      if (!(await page.evaluate(sendUpdate, [WIDGET_HOST_UPDATE, next] as const))) {
        throw new Error("the widget host has not hosted the view yet: no update can reach it");
      }
    };
    return { board: boardOf(page), browser: context, messages, drafts, activity, update };
  };
  return { host };
};
