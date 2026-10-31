// The real board page for the conformance suite (task 9.2): the link the recorder caught, opened in
// Playwright's Chromium as the user opens it, with the board page and the view `dist/view/` holds.
// Controls are found by role and name, as the browser tests find them (EXPERIENCE, Accessibility
// Floor); the board-host messages the page receives are kept, so the suite can compare them with
// the protocol's. The browser tests (9.3) cover the three engines; one is enough here.

import { type Browser, chromium, type Locator, type Page } from "playwright";

const VIEW_FRAME = "iframe[sandbox]";
const LOAD_TIMEOUT_MS = 8_000;
const STEP_TIMEOUT_MS = 5_000;

export type RealBoard = {
  readonly page: Page;
  /** The board-host messages the page received, in order. */
  readonly received: unknown[];
  /** Errors the board page or the view threw. */
  readonly errors: string[];
  /** Waits until the question shows its options, done loading and with no alert. */
  loaded(itemId: string): Promise<void>;
  option(label: string): Locator;
  readonly answer: Locator;
  /** Waits until the receipt reads the given text. */
  receipt(text: "sent" | "delivered to the agent"): Promise<void>;
  /** Waits until the board page shows a banner holding the given text. */
  banner(text: string): Promise<void>;
};

/** Launches Chromium for one test; the caller closes it. */
export const launchBrowser = (): Promise<Browser> => chromium.launch();

/** Opens a board link in a new page and keeps what its board socket receives. */
export const openRealBoard = async (browser: Browser, link: string): Promise<RealBoard> => {
  const page = await browser.newPage();
  const received: unknown[] = [];
  const errors: string[] = [];
  page.on("websocket", (socket) => {
    socket.on("framereceived", ({ payload }) => received.push(JSON.parse(String(payload))));
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(link);
  const view = page.frameLocator(VIEW_FRAME);
  return {
    page,
    received,
    errors,
    loaded: (itemId) =>
      view
        .locator(`[data-askboard-question="${itemId}"]:not([aria-busy="true"])`)
        .filter({ has: view.getByRole("radio") })
        .filter({ hasNot: view.getByRole("alert") })
        .waitFor({ state: "visible", timeout: LOAD_TIMEOUT_MS }),
    option: (label) => view.getByRole("radio", { name: label, exact: true }),
    answer: view.getByRole("button", { name: "Answer", exact: true }),
    receipt: (text) =>
      view.getByText(text, { exact: true }).waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS }),
    banner: (text) => page.getByText(text).waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS }),
  };
};
