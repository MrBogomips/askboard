// The Document review in each engine, on the widget host (document-review, task 6.1;
// view-and-widgets spec: A Document review's document, Commenting on a passage, Suggesting an edit,
// Passages the board does not anchor, Editing and deleting annotations, A Document review's result):
// the document through the Markdown renderer with markup shown as text, a comment written as the
// user types and emptied again, a suggested edit replaced, deleted, unchanged and with only a note,
// the refusals beside the toolbar and in a polite live region, a pin's card with "Edit" and
// "Delete", the 100-annotation limit, long words wrapping inside the frame, no Content Security
// Policy report and `ready` once. At DESIGN's 1,280-pixel floor.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit bun test ./packages/view/test/browser/document-review.browser.ts

import { describe, expect, test } from "bun:test";
import { HUNDRED_WORDS, NOTES, reviewDocument } from "./fixtures/document-review-documents.ts";
import { eventually, QUIET_MS, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS } from "./harness/board-test.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  annotationsHeld,
  card,
  commentOn,
  DOCUMENT,
  heldCount,
  marks,
  messageOf,
  openCardOn,
  pin,
  restoreAnnotations,
  select,
  selectAcross,
  tool,
} from "./harness/review-steps.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const LONG = "w".repeat(200);
// A title holds at most 120 characters.
const TITLE_LONG = "t".repeat(120);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the Document review's document`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "shows its title as text and its document through the renderer, markup as text and a javascript: link with no link, sends ready once and no CSP report",
      async () => {
        const source = `# Plan\n\nSay <script>alert(1)</script> and [x](javascript:alert(1)) here.\n\n${NOTES}`;
        const run = await host(dist, reviewDocument(source, "Release <b>notes</b>"));
        await readyIn(run);
        const { view } = run.board;
        expect(await view.locator("[data-document-review] p").first().textContent()).toBe(
          "Release <b>notes</b>",
        );
        const doc = view.locator(DOCUMENT);
        expect(await doc.getByRole("heading", { name: "Plan" }).count()).toBe(1);
        expect(await doc.locator("script").count()).toBe(0);
        expect(await doc.textContent()).toContain("<script>alert(1)</script>");
        expect(await doc.textContent()).toContain("[x](javascript:alert(1))");
        expect(await doc.locator('a[href^="javascript"]').count()).toBe(0);
        expect(await doc.locator("strong").textContent()).toBe("remembers");
        await Bun.sleep(QUIET_MS);
        expect(run.messages.filter((message) => message.type === "ready")).toHaveLength(1);
        expect(run.drafts).toEqual([]);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a title, a document word, a comment and a replacement of 200 characters with no space wrap inside the frame, and the board scrolls no wider",
      async () => {
        const run = await host(dist, reviewDocument(`Start ${LONG} middle word end.`, TITLE_LONG));
        await readyIn(run);
        const { view } = run.board;
        const comment = await openCardOn(view, "middle", "Comment");
        await comment.getByLabel("Your comment").fill(LONG);
        await comment.getByRole("button", { name: "Done" }).click();
        const edit = await openCardOn(view, "word", "Suggest edit");
        await edit.getByLabel("Replace with").fill(LONG);
        await heldCount(run, 2, "both annotations");
        const fits = (selector: string) =>
          view
            .locator(selector)
            .first()
            .evaluate((el) => el.scrollWidth <= el.clientWidth);
        // The replacement is drawn after its passage, inside the document, while the card is open.
        expect(await fits("[data-document-review]")).toBe(true);
        expect(await fits("[data-document-review] > p")).toBe(true);
        expect(await fits(DOCUMENT)).toBe(true);
        expect(await view.locator("html").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
          true,
        );
        const inside = (locator: ReturnType<typeof card>) =>
          locator.evaluate((el) => {
            const box = el.getBoundingClientRect();
            return el.scrollWidth <= el.clientWidth && box.right <= innerWidth + 1;
          });
        expect(await inside(card(view))).toBe(true);
        await card(view).getByRole("button", { name: "Done" }).click();
        await pin(view, "Comment 1").click();
        await card(view).waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await card(view).textContent()).toContain(LONG);
        expect(await inside(card(view))).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: commenting on a passage and suggesting an edit`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a comment enters the draft as the user types and marks the passage with pin 1; Done closes the card; emptied, it leaves no annotation and no mark",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view } = run.board;
        const dialog = await openCardOn(view, "remembers", "Comment");
        expect(await dialog.getByLabel("Your comment").inputValue()).toBe("");
        await dialog.getByLabel("Your comment").pressSequentially("Say how long.");
        await eventually(
          () => annotationsHeld(run.drafts)[0]?.body.text === "Say how long.",
          "the whole comment in the draft",
        );
        const [held] = annotationsHeld(run.drafts);
        expect(held?.id).toBe("u-1");
        expect(held?.target.selector.exact).toBe("remembers");
        expect(held?.body).toEqual({ text: "Say how long." });
        expect(await marks(view).allTextContents()).toEqual(["remembers"]);
        expect(await pin(view, "Comment 1").textContent()).toBe("1");
        expect(await run.board.answer.isEnabled()).toBe(true);
        await dialog.getByRole("button", { name: "Done" }).click();
        await card(view).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        expect(await marks(view).count()).toBe(1);
        // Open it again, empty it and close it.
        await pin(view, "Comment 1").click();
        await card(view).getByRole("button", { name: "Edit" }).click();
        await card(view).getByLabel("Your comment").fill("");
        await heldCount(run, 0, "no annotation after the text is emptied");
        await card(view).getByRole("button", { name: "Close" }).click();
        await card(view).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(async () => (await marks(view).count()) === 0, "the mark gone");
        expect(await view.getByRole("button", { name: /^Comment \d/ }).count()).toBe(0);
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Escape closes the card and the pin takes the focus back",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view, page } = run.board;
        const dialog = await openCardOn(view, "remembers", "Comment");
        await dialog.getByLabel("Your comment").fill("x");
        await heldCount(run, 1, "the comment");
        await page.keyboard.press("Escape");
        await card(view).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => pin(view, "Comment 1").evaluate((el) => el === el.ownerDocument.activeElement),
          "focus on the pin",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Done closes the card and the pin takes the focus back (the Popover's own close, in each engine)",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view } = run.board;
        const dialog = await openCardOn(view, "remembers", "Comment");
        await dialog.getByLabel("Your comment").fill("x");
        await heldCount(run, 1, "the comment");
        await dialog.getByRole("button", { name: "Done" }).click();
        await card(view).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => pin(view, "Comment 1").evaluate((el) => el === el.ownerDocument.activeElement),
          "focus on the pin",
        );
        // The close control does the same.
        await pin(view, "Comment 1").click();
        await card(view).getByRole("button", { name: "Close" }).click();
        await card(view).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => pin(view, "Comment 1").evaluate((el) => el === el.ownerDocument.activeElement),
          "focus on the pin again",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a suggested edit's replacement starts as the passage; changed, it is held and shown struck through with the replacement after it; emptied, it suggests a deletion",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view } = run.board;
        const dialog = await openCardOn(view, "drafts", "Suggest edit");
        const replacement = dialog.getByLabel("Replace with");
        expect(await replacement.inputValue()).toBe("drafts");
        await replacement.fill("unsent answers");
        await heldCount(run, 1, "the suggestion");
        expect(annotationsHeld(run.drafts)[0]?.body).toEqual({ replacement: "unsent answers" });
        const mark = marks(view).first();
        expect(await mark.textContent()).toBe("drafts");
        expect(await mark.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain(
          "line-through",
        );
        expect(await view.locator("[data-review-ui]").first().textContent()).toContain(
          "unsent answers",
        );
        expect(await pin(view, "Suggested edit 1").count()).toBe(1);
        await replacement.fill("");
        await eventually(
          () => annotationsHeld(run.drafts)[0]?.body.replacement === "",
          "an empty replacement",
        );
        expect(annotationsHeld(run.drafts)[0]?.body).toEqual({ replacement: "" });
        expect(await mark.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain(
          "line-through",
        );
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a replacement left as the passage with no note holds no annotation",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view } = run.board;
        const dialog = await openCardOn(view, "drafts", "Suggest edit");
        await dialog.getByRole("button", { name: "Done" }).click();
        await card(view).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await Bun.sleep(QUIET_MS);
        expect(run.drafts).toEqual([]);
        expect(await marks(view).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "only a note, with the replacement left as the passage, is held as a comment and marked as one",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view } = run.board;
        const dialog = await openCardOn(view, "drafts", "Suggest edit");
        await dialog.getByLabel("Note (optional)").fill("Say which drafts.");
        await heldCount(run, 1, "the note held");
        expect(annotationsHeld(run.drafts)[0]?.body).toEqual({ text: "Say which drafts." });
        expect(
          await marks(view)
            .first()
            .evaluate((el) => getComputedStyle(el).textDecorationLine),
        ).not.toContain("line-through");
        expect(await pin(view, "Comment 1").count()).toBe(1);
        expect(await run.board.answer.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: passages the board does not anchor`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a blank selection and no selection in a document with nothing to take are refused beside the toolbar and in the polite live region",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view } = run.board;
        expect(await select(view, " ")).toBe(true);
        await tool(view, "Comment").click();
        await eventually(
          async () =>
            (await messageOf(view).textContent()) === "Select some text, not only spaces.",
          "the blank message",
        );
        expect(await card(view).count()).toBe(0);
        expect(await messageOf(view).getAttribute("aria-live")).toBe("polite");
        // The message is beside the tools, in the toolbar's row.
        expect(
          await view
            .locator('[role="toolbar"]')
            .locator("xpath=..")
            .locator('[role="status"]')
            .count(),
        ).toBe(1);
        expect(run.drafts).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "several selected ranges are refused with the message (Firefox's multiple selection; Chromium and WebKit hold one range, so the second replaces the first)",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view } = run.board;
        const count = await view.locator(DOCUMENT).evaluate(
          (root) =>
            new Promise<number>((resolve) => {
              const doc = root.ownerDocument;
              const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
              const found: [Node, number, number][] = [];
              for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
                for (const word of ["remembers", "keeps"]) {
                  const at = (node.nodeValue ?? "").indexOf(word);
                  if (at >= 0) found.push([node, at, at + word.length]);
                }
              }
              const selection = doc.defaultView?.getSelection();
              selection?.removeAllRanges();
              doc.addEventListener("selectionchange", () => resolve(selection?.rangeCount ?? 0), {
                once: true,
              });
              for (const [node, from, to] of found) {
                const range = doc.createRange();
                range.setStart(node, from);
                range.setEnd(node, to);
                selection?.addRange(range);
              }
              setTimeout(() => resolve(selection?.rangeCount ?? 0), 300);
            }),
        );
        await tool(view, "Comment").click();
        if (count > 1) {
          await eventually(
            async () => (await messageOf(view).textContent()) === "Select one passage.",
            "the several-ranges message",
          );
          expect(await card(view).count()).toBe(0);
          expect(run.drafts).toEqual([]);
        } else {
          // One range: the last one added, which is a passage like any other.
          await card(view).waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await messageOf(view).textContent()).toBe("");
        }
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a passage that overlaps comment 1 is refused naming it, and a passage repeated with its context asks for a longer one",
      async () => {
        const run = await host(dist, reviewDocument());
        await readyIn(run);
        const { view } = run.board;
        const dialog = await openCardOn(view, "remembers", "Comment");
        await dialog.getByLabel("Your comment").fill("Say how long.");
        await heldCount(run, 1, "the comment");
        await dialog.getByRole("button", { name: "Done" }).click();
        await card(view).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        expect(await selectAcross(view, "board", "remembers")).toBe(true);
        await tool(view, "Suggest edit").click();
        await eventually(
          async () => (await messageOf(view).textContent()) === "This passage overlaps comment 1.",
          "the overlap message",
        );
        expect(await card(view).count()).toBe(0);
        expect(annotationsHeld(run.drafts)).toHaveLength(1);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a sentence the document repeats with the same context is refused with a message asking for a longer passage",
      async () => {
        const run = await host(dist, reviewDocument("ab ".repeat(300)));
        await readyIn(run);
        const { view } = run.board;
        expect(await select(view, "ab")).toBe(true);
        await tool(view, "Comment").click();
        await eventually(
          async () =>
            (await messageOf(view).textContent()) ===
            "This passage repeats in the document. Select a longer one.",
          "the repeated message",
        );
        expect(await card(view).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "with 100 annotations a passage is refused, the draft is unchanged and the message says the document holds the most it takes",
      async () => {
        const document = reviewDocument(`${HUNDRED_WORDS.join(" ")} extra`);
        const run = await host(dist, document);
        await readyIn(run);
        await restoreAnnotations(
          run,
          document,
          HUNDRED_WORDS.map((word, at) => commentOn(`u-${at + 1}`, word)),
        );
        const { view } = run.board;
        await eventually(async () => (await marks(view).count()) === 100, "100 marks");
        const before = run.drafts.length;
        expect(await select(view, "extra")).toBe(true);
        await tool(view, "Comment").click();
        await eventually(
          async () =>
            (await messageOf(view).textContent()) ===
            "This document holds 100 comments and suggested edits, the most it takes. Delete one first.",
          "the limit message",
        );
        expect(await card(view).count()).toBe(0);
        await Bun.sleep(QUIET_MS);
        expect(run.drafts.length).toBe(before);
        expect(await marks(view).count()).toBe(100);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "at 99 annotations a second empty card replaces the first, so typed text always reaches the draft and the 101st is then refused (U-1 of 5.11)",
      async () => {
        const document = reviewDocument(`${HUNDRED_WORDS.join(" ")} extra`);
        const run = await host(dist, document);
        await readyIn(run);
        await restoreAnnotations(
          run,
          document,
          HUNDRED_WORDS.slice(0, 99).map((word, at) => commentOn(`u-${at + 1}`, word)),
        );
        const { view } = run.board;
        await eventually(async () => (await marks(view).count()) === 99, "99 marks");
        // Two empty cards in a row: the second takes the first one's place.
        await openCardOn(view, "w100", "Comment");
        await eventually(async () => (await marks(view).count()) === 100, "the first card's mark");
        await select(view, "extra");
        await tool(view, "Comment").click();
        await eventually(
          async () => (await marks(view).allTextContents()).includes("extra"),
          "the second card's mark",
        );
        expect(await card(view).count()).toBe(1);
        expect(await marks(view).count()).toBe(100);
        expect(await marks(view).allTextContents()).not.toContain("w100");
        await card(view).getByLabel("Your comment").fill("Last one.");
        await heldCount(run, 100, "100 annotations in the draft");
        const last = annotationsHeld(run.drafts).at(-1);
        expect(last?.target.selector.exact).toBe("extra");
        expect(last?.body.text).toBe("Last one.");
        await card(view).getByRole("button", { name: "Done" }).click();
        await select(view, "w100");
        await tool(view, "Comment").click();
        await eventually(
          async () => ((await messageOf(view).textContent()) ?? "").includes("100 comments"),
          "the limit message",
        );
        expect(await card(view).count()).toBe(0);
        expect(annotationsHeld(run.drafts)).toHaveLength(100);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: editing and deleting annotations`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "a pin opens its card reading, with Edit and Delete; Delete removes the annotation, its mark and its pin, renumbers the others and puts the focus on the document",
      async () => {
        const document = reviewDocument();
        const run = await host(dist, document);
        await readyIn(run);
        await restoreAnnotations(run, document, [
          commentOn("u-1", "unsent", "Which ones?"),
          commentOn("u-2", "remembers", "How long?"),
        ]);
        const { view } = run.board;
        await eventually(async () => (await marks(view).count()) === 2, "two marks");
        // The pins are numbered in the document's order, whatever the order they were made in.
        await pin(view, "Comment 1").click();
        const dialog = card(view);
        await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await dialog.textContent()).toContain("How long?");
        expect(await dialog.getByRole("button", { name: "Edit" }).count()).toBe(1);
        await dialog.getByRole("button", { name: "Edit" }).click();
        await dialog.getByLabel("Your comment").fill("How long, exactly?");
        await eventually(
          () => annotationsHeld(run.drafts).some((each) => each.body.text === "How long, exactly?"),
          "the edit in the draft",
        );
        expect(annotationsHeld(run.drafts).map((each) => each.id)).toEqual(["u-1", "u-2"]);
        await dialog.getByRole("button", { name: "Delete" }).click();
        await card(view).waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await heldCount(run, 1, "one annotation left");
        expect(annotationsHeld(run.drafts)[0]?.id).toBe("u-1");
        expect(await marks(view).allTextContents()).toEqual(["unsent"]);
        expect(await pin(view, "Comment 1").count()).toBe(1);
        expect(await pin(view, "Comment 2").count()).toBe(0);
        await eventually(
          () =>
            view
              .locator(`${DOCUMENT} :focus`)
              .count()
              .then((count) => count === 1),
          "the focus on a block of the document",
        );
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a reload under kept work gives the annotations back with their marks and pins, and an untouched review none",
      async () => {
        const document = reviewDocument();
        const run = await host(dist, document);
        await readyIn(run);
        const { view } = run.board;
        expect(await marks(view).count()).toBe(0);
        await restoreAnnotations(run, document, [
          commentOn("u-1", "remembers", "How long?"),
          {
            id: "u-2",
            target: { selector: { type: "quote", exact: "drafts" } },
            body: { replacement: "unsent answers" },
          },
        ]);
        await eventually(async () => (await marks(view).count()) === 2, "both marks");
        expect(await pin(view, "Comment 1").count()).toBe(1);
        expect(await pin(view, "Suggested edit 2").count()).toBe(1);
        expect(await view.locator("[data-review-counter]").textContent()).toBe(
          "Your changes: 1 comment, 1 suggested edit",
        );
        expect(await run.board.answer.isEnabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
