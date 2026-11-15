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
// - options are `radio` (or `checkbox`) controls named by their label; an answered or locked
//   question's options and its primary button are disabled (`disabled` or `aria-disabled`);
// - the controls and the receipt the answering flow moves, found by hooks that no label change
//   touches (answering-flow-guidance, D5): `data-askboard-primary` on the card's "Answer",
//   `data-askboard-submit` on Submit, `data-askboard-postpone` on Postpone,
//   `data-askboard-prefill` on "Select recommended", `data-askboard-next-to-do` on the header's
//   jump, `data-askboard-delivery="immediate|submitted"` on each delivery segment and
//   `data-askboard-receipt="queued|sent|delivered"` on the receipt. A test that asserts a label's
//   text names the label itself and is on the guard's allowlist (`locators.test.ts`);
// - an item that fails shows an `alert` inside its question card;
// - the board banners render on the board page, outside the view: "Connection lost, retrying",
//   one saying the ask was discarded, and one saying the board moved, with "Continue here";
// - push delivery's header row of who asked and where carries `data-askboard-header=
//   "who-and-where"`, its labelled fields a `<dl>` of `<dt>` and `<dd>`; the agent pill is a
//   `status` reading "Agent: …" (task 8.5).

import type { Frame, FrameLocator, Locator, Page } from "playwright";

export const VIEW_FRAME = 'iframe[sandbox="allow-scripts"]';

export type ReceiptKind = "queued" | "sent" | "delivered";

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
  /** The card's primary button, "Answer" in any language (`data-askboard-primary`). */
  readonly answer: Locator;
  /** The bottom bar's Submit. */
  readonly submit: Locator;
  /** The cards' Postpone buttons. */
  readonly postpone: Locator;
  /** The bottom bar's "Select recommended". */
  readonly prefill: Locator;
  /** The header's jump to the next question to do. */
  readonly nextToDo: Locator;
  /** One segment of the delivery mode switch. */
  delivery(mode: "immediate" | "submitted"): Locator;
  /** The delivery receipt: queued ("not sent yet"), sent, or delivered to the agent. */
  receipt(kind: ReceiptKind): Locator;
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
  /** The one status region of the answering flow, outside the cards (answering-flow-fixes, #182). */
  readonly status: Locator;
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
    answer: view.locator("[data-askboard-primary]"),
    submit: view.locator("[data-askboard-submit]"),
    postpone: view.locator("[data-askboard-postpone]"),
    prefill: view.locator("[data-askboard-prefill]"),
    nextToDo: view.locator("[data-askboard-next-to-do]"),
    delivery: (mode) => view.locator(`[data-askboard-delivery="${mode}"]`),
    receipt: (kind) => view.locator(`[data-askboard-receipt="${kind}"]`),
    banner: (text) => page.getByText(text),
    continueHere: page.getByRole("button", { name: "Continue here" }),
    whoAndWhere,
    field: (label) =>
      whoAndWhere
        .locator("dl > div")
        .filter({ has: view.locator("dt").getByText(label, { exact: true }) })
        .locator("dd"),
    status: view.locator('[role="status"][aria-live="polite"][aria-atomic="true"].sr-only'),
    agentPill: view.locator("[data-askboard-agent-pill]").filter({ hasText: /^Agent: / }),
    viewFrame: async () => {
      const content = await (await frame.elementHandle())?.contentFrame();
      if (content === null || content === undefined) throw new Error("the board has no view frame");
      return content;
    },
  };
};
