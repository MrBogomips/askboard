// What every browser test file shares: one browser per engine for the file, and per test a
// session side and a browser context that are closed after the test, also when it fails or times
// out. Waits are bounded below the test's own timeout, so a failure says what it waited for.

import { afterAll, afterEach, beforeAll, expect } from "bun:test";
import { BOARD_TOKEN_QUERY } from "@askboard/contract";
import type { Browser, Locator } from "playwright";
import { BoardContext, type BoardContextOptions, launchEngine } from "./browser.ts";
import { type Board, boardOf } from "./dom.ts";
import type { Engine } from "./engines.ts";
import {
  actsDoneIn,
  type ClickWindow,
  orderProblems,
  pageHalf,
  pageHalfProblems,
} from "./messages.ts";
import { reloadAndWait, viewFrameLost } from "./reload.ts";
import { type BoardSession, type Scenario, startSession } from "./session.ts";
import type { ReplayTranscript } from "./transcripts.ts";

export const TEST_TIMEOUT_MS = 60_000;
/** A cold load to the question done loading; the renderer spike's slowest was about 2.5 s. */
export const LOAD_TIMEOUT_MS = 8_000;
/** One user act or session step to what it shows. */
export const STEP_TIMEOUT_MS = 5_000;
/** A reconnect with backoff after the network returns. */
export const RECONNECT_TIMEOUT_MS = 15_000;
/** How long a test watches for something that must not happen, such as a reconnect. */
export const QUIET_MS = 1_500;

/** The plain-choice question's ID, which every transcript's board document keeps. */
export const QUESTION = "database";

export type BoardRun = {
  readonly session: BoardSession;
  readonly browser: BoardContext;
  readonly scenario: Scenario;
  /** A new tab at the board link, once the view shows the question loaded. */
  open(): Promise<Board>;
  /** A new tab at the board link, without waiting for the view. */
  openTab(): Promise<Board>;
};

export type Closable = { close(): Promise<void> };

/** Closes each, the last opened first, logging what fails to close. */
export const closeAll = async (open: Closable[]): Promise<void> => {
  for (const item of open.reverse()) {
    try {
      await item.close();
    } catch (error) {
      console.error("the browser harness could not close a context or session:", error);
    }
  }
};

// The frames Playwright tracks under the board page: the view's, at `about:srcdoc` once loaded.
const childFrameUrls = (board: Board): string[] =>
  board.page
    .frames()
    .filter((frame) => frame !== board.page.mainFrame())
    .map((frame) => frame.url());

// Why the question did not show, for the failure message: the view's frame, its srcdoc and the
// frame Playwright tracks for it, what the board page shows above the frame (a banner, a load
// error) and logged, the page errors and the session's problems.
const diagnosis = async (board: Board, run: BoardRun): Promise<string> => {
  const frames = await board.frame.count();
  const srcdoc = frames === 0 ? null : await board.frame.first().getAttribute("srcdoc");
  const tracked = childFrameUrls(board);
  const shown = await board.page.locator("[data-askboard-banner], [role='alert']").allInnerTexts();
  const parts = [
    frames === 0 ? "no view frame" : `${frames} view frame(s)`,
    srcdoc === null ? "no srcdoc" : `a srcdoc of ${srcdoc.length} characters`,
    tracked.length === 0
      ? "Playwright tracks no frame"
      : `Playwright's frame at ${tracked.join(", ")}`,
    ...shown.map((text) => `the board page shows: ${text.replace(/\s+/g, " ")}`),
    ...run.browser.console
      .filter((line) => line.text.startsWith("askboard:"))
      .map((line) => `logged: ${line.text}`),
    ...run.browser.errors.map((error) => `page error: ${error}`),
    ...run.session.problems().map((problem) => `session: ${problem}`),
  ];
  return parts.join("; ");
};

/** Waits until the view shows the question loaded: its options shown, no alert in its card. */
export const waitForQuestion = async (
  board: Board,
  run: BoardRun,
  timeout = LOAD_TIMEOUT_MS,
): Promise<void> => {
  try {
    await board.loaded(QUESTION).waitFor({ state: "visible", timeout });
  } catch (error) {
    const first = String(error).split("\n")[0];
    throw new Error(
      `the view did not show the question loaded, with its options and no alert, within ${timeout / 1000} s (${await diagnosis(board, run)}): ${first}`,
    );
  }
};

/**
 * Reloads the board page and waits for the view, as `loaded` says; once more when Playwright lost
 * the view's frame (`reload.ts`). A failure says what the board page shows.
 */
export const reloadBoard = (
  board: Board,
  run: BoardRun,
  loaded: () => Promise<unknown>,
): Promise<void> =>
  reloadAndWait({
    reload: () => board.page.reload(),
    loaded,
    frameLost: async () =>
      viewFrameLost(await board.frame.first().getAttribute("srcdoc"), childFrameUrls(board)),
    failure: async (error) =>
      new Error(
        `the reloaded board did not show the view loaded (${await diagnosis(board, run)}): ${String(error).split("\n")[0]}`,
      ),
    warn: (text) => console.warn(text),
  });

/** The tests of one engine: launches its browser for the file and cleans up after each test. */
export const useEngine = (engine: Engine) => {
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
  const start = async (
    scenario: Scenario,
    options: BoardContextOptions = {},
  ): Promise<BoardRun> => {
    if (browser === undefined) throw new Error(`${engine} did not launch`);
    const session = await startSession(scenario);
    open.push(session);
    const context = await BoardContext.open(browser, options);
    open.push(context);
    const run: BoardRun = {
      session,
      browser: context,
      scenario,
      openTab: async () => boardOf(await context.newTab(session.link)),
      open: async () => {
        const board = boardOf(await context.newTab(session.link));
        await waitForQuestion(board, run);
        return board;
      },
    };
    return run;
  };
  return { start };
};

/** Polls a condition until it holds; fails saying what it waited for. */
export const eventually = async (
  check: () => boolean | Promise<boolean>,
  what: string,
  timeout = STEP_TIMEOUT_MS,
): Promise<void> => {
  const deadline = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`waited ${timeout / 1000} s for ${what}`);
    await Bun.sleep(50);
  }
};

/**
 * Waits until board-host has applied the first `count` act commands the board page sent. The
 * receipt shows "sent" once a command leaves the page, before board-host applies it: the agent's
 * side (`collect`, an `update` on the user's act) waits for this, not for the receipt.
 */
export const actsApplied = (run: BoardRun, count: number): Promise<void> =>
  eventually(
    () => actsDoneIn(run.browser.sockets, count),
    `board-host's done on ${count} act command${count === 1 ? "" : "s"}`,
  );

/** Selects an option and presses "Answer"; returns the click's window for the answer's `when`. */
export const answerWith = async (board: Board, label: string): Promise<ClickWindow> => {
  await board.option(label).click({ timeout: STEP_TIMEOUT_MS });
  const from = Date.now();
  await board.answer.click({ timeout: STEP_TIMEOUT_MS });
  return { from, to: Date.now() };
};

/** The token of the session's board link, which every `connect` carries. */
export const linkToken = (run: BoardRun): string =>
  new URL(run.session.link).searchParams.get(BOARD_TOKEN_QUERY) ?? "";

/** Every page message matches the transcript's, each sent after the host messages before it. */
export const expectPageHalf = (
  run: BoardRun,
  answeredAt?: ClickWindow,
  transcript: ReplayTranscript = run.scenario.transcript,
): void => {
  const sent = run.browser.pageMessages();
  expect(pageHalfProblems(sent, pageHalf(transcript, linkToken(run)), answeredAt)).toEqual([]);
  expect(orderProblems(run.browser.sockets, transcript)).toEqual([]);
  expect(run.session.problems()).toEqual([]);
};

/**
 * The view holds no part of the board's token (AD-8): not in its base URL, which a srcdoc
 * document takes from the board page (whose link keeps the token), its referrer or its location.
 */
export const expectNoTokenInView = async (board: Board, run: BoardRun): Promise<void> => {
  const token = linkToken(run);
  const view = await board.viewFrame();
  const seen = await view.evaluate(() => ({
    baseURI: document.baseURI,
    referrer: document.referrer,
    href: location.href,
  }));
  for (const [where, url] of Object.entries(seen)) {
    const holdsToken = url.includes(token) || /[?&]t=/.test(url);
    expect({ where, url, holdsToken }).toEqual({ where, url, holdsToken: false });
  }
};

/** No CSP violation from the view or the board page, and no CSP line in the console. */
export const expectNoCspProblem = (run: BoardRun): void => {
  expect(run.browser.cspProblems()).toEqual([]);
};

/** The board page opens no further WebSocket for a while. */
export const expectNoReconnect = async (run: BoardRun): Promise<void> => {
  const before = run.browser.sockets.length;
  await Bun.sleep(QUIET_MS);
  expect(run.browser.sockets.length).toBe(before);
};

/** Whether the element is its document's focused element. */
export const isFocused = (locator: Locator): Promise<boolean> =>
  locator.evaluate((element) => element === element.ownerDocument.activeElement);

/** How many of the elements a locator matches the user can act on. */
export const enabledCount = async (locator: Locator): Promise<number> => {
  let enabled = 0;
  for (const element of await locator.all()) if (await element.isEnabled()) enabled += 1;
  return enabled;
};
