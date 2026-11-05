// The real board page for the conformance suite (task 9.2): the link the recorder caught, opened in
// Playwright's Chromium as the user opens it, with the board page and the view `dist/view/` holds.
// Controls are found by role and name, as the browser tests find them (EXPERIENCE, Accessibility
// Floor); the board-host messages the page receives are kept, so the suite can compare them with
// the protocol's. The browser tests (9.3) cover the three engines; one is enough here. A board of
// several questions finds each control inside its question's card (ask-lifecycle, task 7.2).

import { type Browser, chromium, type Locator, type Page } from "playwright";

const VIEW_FRAME = 'iframe[sandbox="allow-scripts"]';
const LOAD_TIMEOUT_MS = 8_000;
export const STEP_TIMEOUT_MS = 5_000;

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
  banner(text: string | RegExp): Promise<void>;
  /** The view's header, with the ask's state pill. */
  readonly header: Locator;
  /** A question's card. */
  card(itemId: string): Locator;
  /** An option of a question's card, a radio or a checkbox, by its label. */
  optionIn(itemId: string, label: string): Locator;
  /** A button of a question's card by its name: Answer, Postpone, More. */
  buttonIn(itemId: string, name: string): Locator;
  /** A question's open prompt, "Note for the agent (optional)". */
  noteIn(itemId: string): Locator;
  /** An item of the open "More" menu. */
  menuItem(name: "Explain" | "Decline"): Locator;
  /** A control of the bottom action bar by its name: Immediate, Submitted, Submit. */
  barButton(name: string): Locator;
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
  const card = (itemId: string) => view.locator(`[data-askboard-question="${itemId}"]`);
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
    banner: (text) =>
      page.getByText(text).first().waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS }),
    header: view.getByRole("banner"),
    card: (itemId) => card(itemId),
    optionIn: (itemId, label) =>
      card(itemId)
        .getByRole("radio", { name: label, exact: true })
        .or(card(itemId).getByRole("checkbox", { name: label, exact: true })),
    buttonIn: (itemId, name) => card(itemId).getByRole("button", { name, exact: true }),
    noteIn: (itemId) =>
      card(itemId).getByRole("textbox", { name: "Note for the agent (optional)" }),
    menuItem: (name) =>
      view
        .getByRole("menuitem", { name, exact: true })
        .or(view.getByRole("menuitemcheckbox", { name, exact: true })),
    barButton: (name) => view.getByRole("contentinfo").getByRole("button", { name, exact: true }),
  };
};
