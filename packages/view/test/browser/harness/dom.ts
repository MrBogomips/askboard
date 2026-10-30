// Where the browser tests find things on a board: the hooks tasks 8.4 to 8.6 build to. Controls
// are found by role and name, as a user finds them (EXPERIENCE, Accessibility Floor); the rest by
// their EXPERIENCE strings, and two structural hooks where no role fits:
//
// - the view is the board page's one sandboxed iframe (AD-8);
// - each question card carries `data-askboard-question="<itemId>"`, and `aria-busy="true"` while
//   its loading state shows (EXPERIENCE, Question loading; AD-9);
// - the view's header is its `banner` landmark (a top-level `<header>`), holding the title and the
//   ask state ("Waiting", "Answered", "Discarded"; EXPERIENCE, Voice and Tone);
// - options are `radio` (or `checkbox`) controls named by their label; "Answer" is a button; an
//   answered or locked question's options and "Answer" are disabled (`disabled` or
//   `aria-disabled`);
// - the delivery receipt reads "not sent yet", "sent" or "delivered to the agent";
// - an item that fails shows an `alert` inside its question card;
// - the board banners render on the board page, outside the view: "Connection lost, retrying",
//   one saying the ask was discarded, and one saying the board moved, with "Continue here".

import type { Frame, FrameLocator, Locator, Page } from "playwright";

export const VIEW_FRAME = "iframe[sandbox]";

export type Board = {
  readonly page: Page;
  /** The view's iframe element, on the board page. */
  readonly frame: Locator;
  /** The view's document, to find anything else in it. */
  readonly view: FrameLocator;
  readonly header: Locator;
  question(itemId: string): Locator;
  /** The question card once its loading state has ended. */
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
};

export const boardOf = (page: Page): Board => {
  const view = page.frameLocator(VIEW_FRAME);
  const frame = page.locator(VIEW_FRAME);
  return {
    page,
    frame,
    view,
    header: view.getByRole("banner"),
    question: (itemId) => view.locator(`[data-askboard-question="${itemId}"]`),
    loaded: (itemId) =>
      view.locator(`[data-askboard-question="${itemId}"]:not([aria-busy="true"])`),
    option: (label) => view.getByRole("radio", { name: label }),
    options: view.getByRole("radio"),
    answer: view.getByRole("button", { name: "Answer", exact: true }),
    receipt: (text) => view.getByText(text, { exact: true }),
    banner: (text) => page.getByText(text),
    continueHere: page.getByRole("button", { name: "Continue here" }),
    viewFrame: async () => {
      const content = await (await frame.elementHandle())?.contentFrame();
      if (content === null || content === undefined) throw new Error("the board has no view frame");
      return content;
    },
  };
};
