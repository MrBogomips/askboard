// What the Document review's browser tests share (document-review, task 6.1): selecting a passage of
// the document as a pointer would leave it, the toolbar and the cards by role and name, and the
// annotations the view mirrored. Not a test file.

import type { DraftRecord } from "@askboard/contract";
import type { FrameLocator, Locator } from "playwright";
import type { ViewDocument } from "../../../src/view-document.ts";
import { eventually, STEP_TIMEOUT_MS } from "./board-test.ts";
import { type DraftSource, draftResultOf } from "./draft-results.ts";
import { openStateOf } from "./view-build.ts";
import type { WidgetHostRun } from "./widget-host-test.ts";

export const DOCUMENT = "[data-review-document]";

/** The annotations the latest mirrored record holds for the review, in order; none when it holds none. */
export const annotationsHeld = (
  drafts: DraftSource,
  itemId = "review",
): readonly {
  id: string;
  target: { selector: { exact: string; prefix?: string; suffix?: string } };
  body: { text?: string; replacement?: string };
}[] => {
  const result = draftResultOf(drafts, "plan", itemId) as { annotations?: never[] } | undefined;
  return (result?.annotations ?? []) as never;
};

/**
 * Selects the first text `needle` occurs in inside the document (not in an element the widget
 * added), as a range of one text node, and waits for the `selectionchange` it fires; returns whether
 * the text was found.
 */
export const select = (view: FrameLocator, needle: string, skip = 0): Promise<boolean> =>
  view.locator(DOCUMENT).evaluate(
    (root, [text, skipped]) =>
      new Promise<boolean>((resolve) => {
        const doc = root.ownerDocument;
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let seen = 0;
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const at = (node.nodeValue ?? "").indexOf(text as string);
          if (at < 0 || node.parentElement?.closest("[data-review-ui]")) continue;
          if (seen < (skipped as number)) {
            seen += 1;
            continue;
          }
          const range = doc.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + (text as string).length);
          const selection = doc.defaultView?.getSelection();
          selection?.removeAllRanges();
          doc.addEventListener("selectionchange", () => resolve(true), { once: true });
          selection?.addRange(range);
          // A selection that does not change fires no event: do not wait for one.
          setTimeout(() => resolve(true), 250);
          return;
        }
        resolve(false);
      }),
    [needle, skip] as const,
  );

/** Selects from the start of `from` to the end of `to`, across the text nodes between them. */
export const selectAcross = (view: FrameLocator, from: string, to: string): Promise<boolean> =>
  view.locator(DOCUMENT).evaluate(
    (root, [first, last]) =>
      new Promise<boolean>((resolve) => {
        const doc = root.ownerDocument;
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let start: [Node, number] | undefined;
        let end: [Node, number] | undefined;
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const data = node.nodeValue ?? "";
          if (start === undefined && data.includes(first as string)) {
            start = [node, data.indexOf(first as string)];
          }
          if (start !== undefined && data.includes(last as string)) {
            end = [node, data.indexOf(last as string) + (last as string).length];
            break;
          }
        }
        if (start === undefined || end === undefined) {
          resolve(false);
          return;
        }
        const range = doc.createRange();
        range.setStart(start[0], start[1]);
        range.setEnd(end[0], end[1]);
        const selection = doc.defaultView?.getSelection();
        selection?.removeAllRanges();
        doc.addEventListener("selectionchange", () => resolve(true), { once: true });
        selection?.addRange(range);
        setTimeout(() => resolve(true), 250);
      }),
    [from, to] as const,
  );

export const tool = (view: FrameLocator, name: "Comment" | "Suggest edit"): Locator =>
  view.getByRole("toolbar").getByRole("button", { name, exact: true });

export const card = (view: FrameLocator): Locator => view.getByRole("dialog");

export const pin = (view: FrameLocator, name: string): Locator =>
  view.getByRole("button", { name, exact: true });

export const messageOf = (view: FrameLocator): Locator =>
  view.locator('[data-document-review] [role="status"]');

export const marks = (view: FrameLocator): Locator => view.locator("[data-review-mark]");

/** Selects `needle`, presses `name`, and waits for the card. */
export const openCardOn = async (
  view: FrameLocator,
  needle: string,
  name: "Comment" | "Suggest edit",
): Promise<Locator> => {
  if (!(await select(view, needle))) throw new Error(`no "${needle}" to select`);
  await tool(view, name).click();
  await card(view).waitFor({ timeout: STEP_TIMEOUT_MS });
  return card(view);
};

/** Waits until the latest mirrored record holds `count` annotations for the review. */
export const heldCount = (run: WidgetHostRun, count: number, what: string): Promise<void> =>
  eventually(() => annotationsHeld(run.drafts).length === count, what, STEP_TIMEOUT_MS);

/** Restores `annotations` as the review's result, as a reload under kept work would. */
export const restoreAnnotations = async (
  run: WidgetHostRun,
  document: ViewDocument,
  annotations: readonly unknown[],
  id = 1,
): Promise<void> => {
  const record: DraftRecord = {
    delivery: "immediate",
    questions: { plan: { rev: 1, results: { review: { annotations } } } },
  } as never;
  await run.update({ type: "state", state: openStateOf(document), restore: { id, record } });
};

/** A quote of `exact` with no context, for a document where it occurs once. */
export const quoteOf = (exact: string) => ({ type: "quote", exact });

/** An annotation id, a quote and a comment's text. */
export const commentOn = (id: string, exact: string, text = "Noted.") => ({
  id,
  target: { selector: quoteOf(exact) },
  body: { text },
});
