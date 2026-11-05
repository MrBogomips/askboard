// Where the browser tests find things on a board: the hooks tasks 8.4 to 8.6 build to. Controls
// are found by role and name, as a user finds them (EXPERIENCE, Accessibility Floor); the rest by
// their EXPERIENCE strings, and two structural hooks where no role fits:
//
// - the view is the board page's one sandboxed iframe (AD-8);
// - each question card carries `data-askboard-question="<itemId>"`, and `aria-busy="true"` while
//   its loading state shows (EXPERIENCE, Question loading; AD-9), and
//   `data-askboard-in-view="true"` or `"false"` once the view's observer has reported it in view
//   or out of it;
// - the view's header is its `banner` landmark (a top-level `<header>`), holding the title and the
//   ask state ("Waiting", "Answered", "Discarded"; EXPERIENCE, Voice and Tone);
// - options are `radio` (or `checkbox`) controls named by their label; "Answer" is a button; an
//   answered or locked question's options and "Answer" are disabled (`disabled` or
//   `aria-disabled`);
// - the delivery receipt reads "not sent yet", "sent" or "delivered to the agent";
// - an item that fails shows an `alert` inside its question card;
// - the board banners render on the board page, outside the view: "Connection lost, retrying",
//   one saying the ask was discarded, and one saying the board moved, with "Continue here";
// - push delivery's header row of who asked and where carries `data-askboard-header=
//   "who-and-where"`, its labelled fields a `<dl>` of `<dt>` and `<dd>`; the agent pill is a
//   `status` reading "Agent: …" (task 8.5).

import type { Frame, FrameLocator, Locator, Page } from "playwright";

export const VIEW_FRAME = 'iframe[sandbox="allow-scripts"]';

export type Board = {
  readonly page: Page;
  /** The view's iframe element, on the board page. */
  readonly frame: Locator;
  /** The view's document, to find anything else in it. */
  readonly view: FrameLocator;
  readonly header: Locator;
  question(itemId: string): Locator;
  /**
   * The question card once it has loaded: not busy, with its options and no alert. A failed item
   * also ends the loading state, so `aria-busy` alone would match a board whose component crashed.
   */
  loaded(itemId: string): Locator;
  option(label: string): Locator;
  readonly options: Locator;
  readonly answer: Locator;
  receipt(text: "not sent yet" | "sent" | "delivered to the agent"): Locator;
  /** Text on the board page itself, where the banners are. */
  banner(text: string | RegExp): Locator;
  readonly continueHere: Locator;
  /** The view's frame, to run code in its document. */
  viewFrame(): Promise<Frame>;
  /** The header's row of who asked and where (push delivery). */
  readonly whoAndWhere: Locator;
  /** Row 1's value of a labelled field: Project, Directory, Branch or Worktree. */
  field(label: "Project" | "Directory" | "Branch" | "Worktree"): Locator;
  /** The agent pill. */
  readonly agentPill: Locator;
};

export const boardOf = (page: Page): Board => {
  const view = page.frameLocator(VIEW_FRAME);
  const frame = page.locator(VIEW_FRAME);
  const whoAndWhere = view.locator('[data-askboard-header="who-and-where"]');
  return {
    page,
    frame,
    view,
    header: view.getByRole("banner"),
    question: (itemId) => view.locator(`[data-askboard-question="${itemId}"]`),
    loaded: (itemId) =>
      view
        .locator(`[data-askboard-question="${itemId}"]:not([aria-busy="true"])`)
        .filter({ has: view.getByRole("radio").or(view.getByRole("checkbox")) })
        .filter({ hasNot: view.getByRole("alert") }),
    option: (label) => view.getByRole("radio", { name: label }),
    // Inside a question: the header's quick toggles are radio groups too (settings-languages).
    options: view.locator("[data-askboard-question]").getByRole("radio"),
    answer: view.getByRole("button", { name: "Answer", exact: true }),
    receipt: (text) => view.getByText(text, { exact: true }),
    banner: (text) => page.getByText(text),
    continueHere: page.getByRole("button", { name: "Continue here" }),
    whoAndWhere,
    field: (label) =>
      whoAndWhere
        .locator("dl > div")
        .filter({ has: view.locator("dt").getByText(label, { exact: true }) })
        .locator("dd"),
    agentPill: view.getByRole("status").filter({ hasText: /^Agent: / }),
    viewFrame: async () => {
      const content = await (await frame.elementHandle())?.contentFrame();
      if (content === null || content === undefined) throw new Error("the board has no view frame");
      return content;
    },
  };
};
