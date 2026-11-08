// The Document review on the real board page and the session process, in each engine
// (document-review, task 7.1; Issues #92, #93 and #103; design decisions 14 and 15; spec
// view-and-widgets: Detached annotations, The answer gates read the revision the card shows, A
// Document review on a revision the board cannot show, Links in a Document review):
// - a comment and a suggested edit answered, read through `collect` and `fetch`, and brought back
//   with their marks by a reload;
// - the agent reopening the answered question with a revision that rewrites the commented word:
//   "Start from my previous answer" lists the comment as detached and "Answer" sends nothing until
//   it is deleted, also after a reload;
// - the gates read the revision the card shows (review S-1 of 6.5): "Keep mine" with no reload keeps
//   the comment marked, nothing detached, no hint, and "Answer" and Submit send it naming
//   revision 1;
// - the read-only rule (design decision 15): after a reload and "Keep mine" the Document review is
//   read-only with the line, takes no selection, lists a comment the shown text does not place
//   without "Delete" and without a hint, and sends it naming revision 1, in submitted delivery too
//   ("Select recommended" marks the question ready, and a tab that is not selected shows no
//   correction dot, review S-2 of 5.6); "Reload, losing my work" makes it editable again, also
//   inside a Group;
// - a link opened through the board page, and a Document review nested in a Group inside Tabs;
// - an answer too large (oversized-acts, merged; task 8.2, review X-1 of 4.3): Document reviews of
//   one question filled to the bounds with suggested edits in emoji, so that the draft record and
//   the answer act both pass the board's limits: "Answer" shows the act line with the size and the
//   limit, sends nothing, opens no new socket and keeps the work, and an answer to another question
//   of the ask then goes and is collected.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/document-review-session.browser.ts

import { describe, expect, test } from "bun:test";
import {
  ANNOTATION_MAX_CHARS,
  ANNOTATION_REPLACEMENT_MAX_CHARS,
  BOARD_MESSAGE_MAX_BYTES,
  DOCUMENT_REVIEW_ANNOTATIONS_MAX,
  DRAFT_RECORD_MAX_CHARS,
  TEXT_FIELD_MAX_CHARS,
} from "@askboard/contract";
import type { FrameLocator } from "playwright";
import { atomAsk } from "./fixtures/atom-documents.ts";
import { HUNDRED_WORDS, NOTES, reviewItem } from "./fixtures/document-review-documents.ts";
import { database, plain } from "./fixtures/lifecycle-asks.ts";
import { checkedEvents, checkedFetchItem } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  expectNoReconnect,
  LOAD_TIMEOUT_MS,
  QUIET_MS,
  reloadBoard,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  barButton,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  optionOf,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import {
  annotationsHeld,
  DOCUMENT,
  marks,
  openCardOn,
  pin,
  select,
  tool,
} from "./harness/review-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const TITLE = "Release notes";
const LONG = "w".repeat(200);
// A title holds at most 120 characters.
const TITLE_LONG = "t".repeat(120);
const LINE_START = "Read-only: your work";
// The agent's revisions of the document: the commented word rewritten, and another paragraph.
const REWRITTEN = NOTES.replace("remembers", "recalls");
const OTHER_PARAGRAPH = NOTES.replace(
  "See the [docs](https://example.com/docs) for more.",
  "Another paragraph.",
);

const review = () => reviewItem(NOTES, TITLE);
const group = (...items: unknown[]) => ({
  type: "group",
  id: "box",
  props: { title: "Box", items },
});
const tabs = (...panels: { id: string; title: string; items: unknown[] }[]) => ({
  type: "tabs",
  id: "sections",
  props: { tabs: panels },
});
const who = { type: "text-field", id: "who", props: { label: "Who" } };
// A submitted-delivery board needs two questions to show its Submit bar: the question `plan` holding
// the items, and a plain `other`.
const submittedAsk = (...items: unknown[]) => {
  const ask = atomAsk(items as never, { delivery: "submitted" });
  return { ...ask, items: [...ask.items, plain("other", "Should the order service cache reads?")] };
};

type Run = Parameters<typeof reloadBoard>[1];
type Session = { session: { update(actions: readonly unknown[]): Promise<unknown> } };

const revise = (run: Session, markdown: string) =>
  run.session.update([
    { action: "change", itemId: "review", props: reviewItem(markdown, TITLE).props },
  ]);

const notice = (board: Board, kind = "agent-change") =>
  card(board, "plan").locator(`[data-askboard-notice="${kind}"]`);
const choose = async (board: Board, name: "Keep mine" | "Reload, losing my work") => {
  await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
  await notice(board)
    .getByRole("button", { name, exact: true })
    .click({ timeout: STEP_TIMEOUT_MS });
  await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
};
const line = (board: Board) => board.view.locator('[data-askboard-read-only="review"]');
const detached = (view: FrameLocator) => view.getByRole("region", { name: "Detached comments" });
const hintOf = async (board: Board): Promise<string | undefined> => {
  const id = await answerOf(board, "plan").getAttribute("aria-describedby");
  return id === null
    ? undefined
    : ((await board.view.locator(`[id="${id}"]`).textContent()) ?? undefined);
};

const comment = async (view: FrameLocator, word: string, text: string): Promise<void> => {
  const dialog = await openCardOn(view, word, "Comment");
  await dialog.getByLabel("Your comment").fill(text);
  await dialog.getByRole("button", { name: "Done" }).click();
  await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
};
const suggest = async (view: FrameLocator, word: string, replacement: string): Promise<void> => {
  const dialog = await openCardOn(view, word, "Suggest edit");
  await dialog.getByLabel("Replace with").fill(replacement);
  await dialog.getByRole("button", { name: "Done" }).click();
  await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
};
// Waits until the board page has mirrored `count` annotations for the review.
const held = (run: Run, count: number): Promise<void> =>
  eventually(
    () => annotationsHeld(sentDrafts(run)).length === count,
    `${count} annotation(s) mirrored to the board page`,
    STEP_TIMEOUT_MS,
  );

const documentShown = (board: Board) =>
  board.view.locator(DOCUMENT).waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
const reloaded = (board: Board, run: Run) => reloadBoard(board, run, () => documentShown(board));

type Annotation = {
  readonly id: string;
  readonly target: { readonly selector: { readonly exact: string } };
  readonly body: { readonly text?: string; readonly replacement?: string };
};
// The annotations of the review in an answer event's results.
const annotationsOf = (event: Readonly<Record<string, unknown>> | undefined): Annotation[] =>
  ((event?.results as { review?: { annotations?: Annotation[] } } | undefined)?.review
    ?.annotations ?? []) as Annotation[];
const answersOf = (json: unknown) => checkedEvents(json).filter((event) => event.type === "answer");

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Document review answered, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "a comment and a suggested edit: a reload brings both back with their marks, Answer sends them, collect returns them and fetch returns the item's result",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([review()]), dist));
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        await comment(view, "remembers", "How long?");
        await suggest(view, "drafts", "unsent answers");
        await held(run, 2);
        expect(sentActs(run)).toEqual([]);
        await reloaded(board, run);
        await eventually(async () => (await marks(view).count()) === 2, "both marks back");
        expect(await pin(view, "Comment 1").count()).toBe(1);
        expect(await pin(view, "Suggested edit 2").count()).toBe(1);
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const events = checkedEvents(await run.session.collectJson());
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({ type: "answer", itemId: "plan", rev: 1 });
        const annotations = annotationsOf(events[0]);
        expect(annotations).toHaveLength(2);
        expect(annotations[0]?.target.selector.exact).toBe("remembers");
        expect(annotations[0]?.body).toEqual({ text: "How long?" });
        expect(annotations[1]?.target.selector.exact).toBe("drafts");
        expect(annotations[1]?.body).toEqual({ replacement: "unsent answers" });
        const item = checkedFetchItem(await run.session.fetch("review"));
        expect(item.type).toBe("document-review");
        expect(item.questionId).toBe("plan");
        expect(item.state).toBe("answered");
        expect(item.result).toEqual({ annotations });
        await card(board, "plan")
          .getByText("delivered to the agent", { exact: true })
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent reopens the question with the commented word rewritten: Start from my previous answer lists the comment as detached, Answer sends nothing until it is deleted, also after a reload",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([review()]), dist));
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        await comment(view, "remembers", "How long?");
        await comment(view, "Second item", "Keep this.");
        await held(run, 2);
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        await run.session.update([
          { action: "reopen", itemId: "plan" },
          { action: "change", itemId: "review", props: reviewItem(REWRITTEN, TITLE).props },
        ]);
        const reopened = notice(board, "reopened");
        await reopened.waitFor({ timeout: STEP_TIMEOUT_MS });
        await reopened.getByRole("button", { name: "Start from my previous answer" }).click({
          timeout: STEP_TIMEOUT_MS,
        });
        await eventually(async () => (await detached(view).count()) === 1, "the detached list");
        expect(await detached(view).textContent()).toContain("How long?");
        await eventually(
          async () => (await marks(view).allTextContents()).join() === "Second item",
          "the kept comment marked",
        );
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        expect(await hintOf(board)).toBe("Delete the detached comments in Release notes first.");
        await reloaded(board, run);
        await eventually(async () => (await detached(view).count()) === 1, "the list after reload");
        expect(await answerOf(board, "plan").isDisabled()).toBe(true);
        expect(await hintOf(board)).toBe("Delete the detached comments in Release notes first.");
        await Bun.sleep(QUIET_MS);
        expect(sentActs(run)).toHaveLength(1);

        await detached(view)
          .getByRole("button", { name: /^Delete/ })
          .click();
        await eventually(async () => (await detached(view).count()) === 0, "the list gone");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        expect(await hintOf(board)).toBeUndefined();
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const answers = answersOf(await run.session.collectJson());
        const second = answers.at(-1);
        // The reopening is revision 2, the agent's change of the document revision 3.
        expect(second).toMatchObject({ rev: 3 });
        expect(annotationsOf(second).map((each) => each.body.text)).toEqual(["Keep this."]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a link is opened through the board page once, with no opener and no referrer, and sends the agent nothing",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([review()]), dist));
        const board = await openBoard(run, ["plan"]);
        await board.page.evaluate(() => {
          const calls: unknown[][] = [];
          (window as unknown as { __opened: unknown[][] }).__opened = calls;
          window.open = ((...args: unknown[]) => {
            calls.push(args);
            return null;
          }) as typeof window.open;
        });
        const pages = run.browser.context.pages().length;
        await board.view.getByRole("link", { name: "docs", exact: true }).click();
        const opened = () =>
          board.page.evaluate(() => (window as unknown as { __opened: unknown[][] }).__opened);
        await eventually(async () => (await opened()).length === 1, "the stubbed window.open call");
        expect(await opened()).toEqual([
          ["https://example.com/docs", "_blank", "noopener,noreferrer"],
        ]);
        expect(run.browser.context.pages().length).toBe(pages);
        expect(sentActs(run)).toEqual([]);
        expect((await run.session.collect()).events).toEqual([]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a Document review in a Group inside a Tabs is answered: its comment is mirrored and collect returns it",
      async () => {
        const nested = tabs(
          { id: "first", title: "First", items: [who] },
          { id: "second", title: "Review", items: [group(review())] },
        );
        const run = await start(lifecycleScenario(atomAsk([nested]), dist));
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        await view.getByRole("tab", { name: "Review", exact: true }).click();
        await comment(view, "remembers", "Nested.");
        await held(run, 1);
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const [answer, ...rest] = answersOf(await run.session.collectJson());
        expect(rest).toEqual([]);
        expect(Object.keys((answer?.results ?? {}) as object)).toEqual(["review"]);
        expect(annotationsOf(answer).map((each) => each.body.text)).toEqual(["Nested."]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the gates read the revision the card shows, on the session process`, () => {
    const { start } = useEngine(engine);

    // The comment on "remembers" is made on revision 1 and mirrored; the agent's revision 2 rewrites
    // the word. "Keep mine" is chosen with no reload, so the card keeps showing revision 1.
    const keptComment = async (run: Awaited<ReturnType<typeof start>>, ids = ["plan"]) => {
      const board = await openBoard(run, ids);
      await comment(board.view, "remembers", "How long?");
      await held(run, 1);
      await revise(run, REWRITTEN);
      await choose(board, "Keep mine");
      return board;
    };
    const shownAsKept = async (board: Board) => {
      expect(await marks(board.view).allTextContents()).toEqual(["remembers"]);
      expect(await detached(board.view).count()).toBe(0);
      expect(await hintOf(board)).toBeUndefined();
    };

    test(
      "Keep mine with no reload: the comment stays marked, nothing is detached, no hint shows, and Answer sends it naming revision 1",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([review()]), dist));
        const board = await keptComment(run);
        await shownAsKept(board);
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        expect(events[0]).toMatchObject({ edit: "ignore", keptRev: 1 });
        expect(annotationsOf(events[1]).map((each) => each.body.text)).toEqual(["How long?"]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Keep mine in submitted delivery: the held answer is not refused, and Submit sends the comment naming revision 1",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk(review()), dist));
        const board = await keptComment(run, ["plan", "other"]);
        await shownAsKept(board);
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await mirrored(run, (record) => record.questions.plan?.held?.act === "answer", "held");
        await eventually(async () => !(await barButton(board, "Submit").isDisabled()), "Submit");
        await barButton(board, "Submit").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => sentActs(run).some((each) => each.acts.some((act) => act.type === "answer")),
          "the answer to be sent",
        );
        await actsDone(run, sentActs(run).length);
        const [answer, ...rest] = answersOf(await run.session.collectJson());
        expect(rest).toEqual([]);
        expect(answer).toMatchObject({ rev: 1 });
        expect(annotationsOf(answer).map((each) => each.body.text)).toEqual(["How long?"]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: a Document review the board cannot show, on the session process`, () => {
    const { start } = useEngine(engine);

    const plainAsk = (more: Readonly<Record<string, unknown>> = {}) => atomAsk([review()], more);
    const nestedAsk = (more: Readonly<Record<string, unknown>> = {}) =>
      atomAsk([group(review())], more);

    // A comment on "remembers" is made on revision 1 and mirrored, the agent revises the document,
    // the tab reloads, and the notice shows again over the page that never saw revision 1.
    const afterReload = async (
      run: Awaited<ReturnType<typeof start>>,
      markdown: string,
      ids = ["plan"],
    ): Promise<Board> => {
      const board = await openBoard(run, ids);
      await comment(board.view, "remembers", "How long?");
      await held(run, 1);
      await revise(run, markdown);
      await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
      await reloaded(board, run);
      await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
      return board;
    };
    // The line of a Document review in a tab that is not selected is attached but hidden.
    const readOnlyLine = async (board: Board, state: "visible" | "attached" = "visible") => {
      await line(board).waitFor({ state, timeout: STEP_TIMEOUT_MS });
      expect(await line(board).textContent()).toContain(LINE_START);
    };
    const sentAsKept = async (run: Run, board: Board) => {
      await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
      await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
      await actsDone(run, 2);
      const events = checkedEvents(await run.session.collectJson());
      expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
        "edit-choice:2",
        "answer:1",
      ]);
      expect(events[0]).toMatchObject({ edit: "ignore", keptRev: 1 });
      expect(annotationsOf(events[1]).map((each) => each.body.text)).toEqual(["How long?"]);
    };

    for (const [name, ask] of [
      ["", plainAsk],
      [" inside a Group", nestedAsk],
    ] as const) {
      test(
        `another paragraph changed, a reload and Keep mine${name}: the Document review is read-only with the line, shows the comment, offers no Comment or Suggest edit, leaves the draft as it was, and Answer sends the comment naming revision 1`,
        async () => {
          const run = await start(lifecycleScenario(ask(), dist));
          const board = await afterReload(run, OTHER_PARAGRAPH);
          await choose(board, "Keep mine");
          await readOnlyLine(board);
          const { view } = board;
          await eventually(async () => (await marks(view).count()) === 1, "the mark");
          expect(await marks(view).allTextContents()).toEqual(["remembers"]);
          expect(await pin(view, "Comment 1").count()).toBe(1);
          expect(await detached(view).count()).toBe(0);
          expect(await hintOf(board)).toBeUndefined();
          const before = JSON.stringify(sentDrafts(run).at(-1));
          expect(await select(view, "drafts")).toBe(true);
          await Bun.sleep(QUIET_MS);
          expect(await tool(view, "Comment").count()).toBe(0);
          expect(await tool(view, "Suggest edit").count()).toBe(0);
          expect(await view.getByRole("dialog").count()).toBe(0);
          expect(JSON.stringify(sentDrafts(run).at(-1))).toBe(before);
          expect(annotationsHeld(sentDrafts(run)).map((each) => each.body.text)).toEqual([
            "How long?",
          ]);
          // The line stays while the page cannot show the revision the work was made on.
          expect(await line(board).count()).toBe(1);
          await sentAsKept(run, board);
          expectNoCspProblem(run);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "the commented word rewritten, a reload and Keep mine: the comment is listed as detached without Delete, no hint asks to delete it, and Answer sends it naming revision 1",
      async () => {
        const run = await start(lifecycleScenario(plainAsk(), dist));
        const board = await afterReload(run, REWRITTEN);
        await choose(board, "Keep mine");
        await readOnlyLine(board);
        const { view } = board;
        await eventually(async () => (await detached(view).count()) === 1, "the detached list");
        expect(await detached(view).textContent()).toContain("How long?");
        expect(await detached(view).getByRole("button").count()).toBe(0);
        expect(await marks(view).count()).toBe(0);
        expect(await hintOf(board)).toBeUndefined();
        await sentAsKept(run, board);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    for (const [name, ask] of [
      ["", plainAsk],
      [" inside a Group", nestedAsk],
    ] as const) {
      test(
        `Reload, losing my work${name}: the line goes, the comment goes, and a selection is commented on the current revision`,
        async () => {
          const run = await start(lifecycleScenario(ask(), dist));
          const board = await afterReload(run, OTHER_PARAGRAPH);
          await readOnlyLine(board);
          await choose(board, "Reload, losing my work");
          await eventually(async () => (await line(board).count()) === 0, "the line to go");
          const { view } = board;
          expect(await marks(view).count()).toBe(0);
          expect(await pin(view, "Comment 1").count()).toBe(0);
          await comment(view, "drafts", "On revision 2.");
          await eventually(
            () =>
              annotationsHeld(sentDrafts(run))
                .map((each) => each.body.text)
                .join() === "On revision 2.",
            "the new comment mirrored, the old one gone",
          );
          expect(sentDrafts(run).at(-1)?.questions.plan?.rev).toBe(2);
          await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
          await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
          await actsDone(run, 2);
          const events = checkedEvents(await run.session.collectJson());
          expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
            "edit-choice:2",
            "answer:2",
          ]);
          expect(events[0]).toMatchObject({ edit: "reload" });
          expect(annotationsOf(events[1]).map((each) => each.target.selector.exact)).toEqual([
            "drafts",
          ]);
          expectNoCspProblem(run);
        },
        TEST_TIMEOUT_MS,
      );
    }

    test(
      "a read-only Document review holding a detached comment, in submitted delivery: Submit is enabled with no hint and sends the comment naming revision 1",
      async () => {
        const run = await start(lifecycleScenario(submittedAsk(review()), dist));
        const board = await afterReload(run, REWRITTEN, ["plan", "other"]);
        await choose(board, "Keep mine");
        await readOnlyLine(board);
        await eventually(async () => (await detached(board.view).count()) === 1, "the list");
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        expect(await hintOf(board)).toBeUndefined();
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await mirrored(run, (record) => record.questions.plan?.held?.act === "answer", "held");
        expect(await hintOf(board)).toBeUndefined();
        await eventually(async () => !(await barButton(board, "Submit").isDisabled()), "Submit");
        await barButton(board, "Submit").click({ timeout: STEP_TIMEOUT_MS });
        await eventually(
          () => sentActs(run).some((each) => each.acts.some((act) => act.type === "answer")),
          "the answer to be sent",
        );
        await actsDone(run, sentActs(run).length);
        const [answer, ...rest] = answersOf(await run.session.collectJson());
        expect(rest).toEqual([]);
        expect(answer).toMatchObject({ rev: 1 });
        expect(annotationsOf(answer).map((each) => each.body.text)).toEqual(["How long?"]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "Select recommended marks a question holding that read-only Document review ready, rather than skipping it",
      async () => {
        const first = database("plan");
        const ask = {
          askId: "review-recommended-t7q1",
          title: "Order service storage",
          delivery: "submitted",
          items: [{ ...first, props: { ...first.props, items: [review()] } }, database("other")],
        };
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan", "other"]);
        await comment(board.view, "remembers", "How long?");
        await held(run, 1);
        await revise(run, REWRITTEN);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await reloaded(board, run);
        await choose(board, "Keep mine");
        await readOnlyLine(board);
        await eventually(async () => (await detached(board.view).count()) === 1, "the list");
        await barButton(board, "Select recommended").click({ timeout: STEP_TIMEOUT_MS });
        await mirrored(
          run,
          (record) =>
            record.questions.plan?.held?.act === "answer" &&
            record.questions.other?.held?.act === "answer",
          "both questions marked ready",
        );
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "inside a Tabs tab that is not selected, a detached comment of a read-only Document review puts no correction dot on its tab",
      async () => {
        const nested = tabs(
          { id: "first", title: "First", items: [who] },
          { id: "second", title: "Review", items: [review()] },
        );
        const run = await start(lifecycleScenario(atomAsk([nested]), dist));
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        await view.getByRole("tab", { name: "Review", exact: true }).click();
        await comment(view, "remembers", "How long?");
        await held(run, 1);
        await revise(run, REWRITTEN);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await reloaded(board, run);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await choose(board, "Keep mine");
        await readOnlyLine(board, "attached");
        expect(await view.getByRole("tab", { name: "First" }).getAttribute("aria-selected")).toBe(
          "true",
        );
        // The list sits in a panel that is not selected, which a role locator leaves out.
        await eventually(
          async () => (await view.getByText("Detached comments", { exact: true }).count()) === 1,
          "the list",
        );
        expect(await view.getByRole("tab", { name: "Review", exact: true }).count()).toBe(1);
        expect(await view.getByRole("tab", { name: "Review needs a correction" }).count()).toBe(0);
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        expect(await hintOf(board)).toBeUndefined();
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: long unspaced words, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "a title of 120 characters and a document word, a comment and a replacement of 200 with no space wrap inside the frame at 1,280 pixels, and the board scrolls no wider",
      async () => {
        const item = reviewItem(`Start ${LONG} middle word end.`, TITLE_LONG);
        const run = await start(lifecycleScenario(atomAsk([item]), dist));
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        expect(await board.page.evaluate(() => window.innerWidth)).toBe(1280);
        await documentShown(board);
        await comment(view, "middle", LONG);
        await suggest(view, "word", LONG);
        await held(run, 2);
        const fits = (selector: string) =>
          view
            .locator(selector)
            .first()
            .evaluate((el) => el.scrollWidth <= el.clientWidth);
        expect(await fits("[data-document-review]")).toBe(true);
        expect(await fits("[data-document-review] > p")).toBe(true);
        expect(await fits(DOCUMENT)).toBe(true);
        expect(await view.locator("html").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
          true,
        );
        expect(await board.page.evaluate(() => document.documentElement.scrollWidth <= 1280)).toBe(
          true,
        );
        const title = view.getByText(TITLE_LONG, { exact: true });
        expect(await title.count()).toBeGreaterThan(0);
        expect(await title.first().evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        const inside = (locator: ReturnType<typeof view.getByRole>) =>
          locator.evaluate((el) => {
            const box = el.getBoundingClientRect();
            return el.scrollWidth <= el.clientWidth && box.right <= innerWidth + 1;
          });
        await pin(view, "Comment 1").click();
        const dialog = view.getByRole("dialog");
        await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await dialog.textContent()).toContain(LONG);
        expect(await inside(dialog)).toBe(true);
        await dialog.getByRole("button", { name: "Close" }).click();
        await pin(view, "Suggested edit 2").click();
        await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await dialog.textContent()).toContain(LONG);
        expect(await inside(dialog)).toBe(true);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}

// Documents filled to the bounds: two reviews, each of the hundred words w001 to w100, each of which
// takes a suggested edit whose replacement and note are filled to their bounds in a character of
// three bytes and one UTF-16 unit, the most bytes of an answer a text box admits (its `maxLength`
// counts units, so four-byte characters would fit half as many bytes). Two reviews pass the draft
// limit but not the message limit (a third would take as long again to fill), so TextFields filled
// the same way carry the answer past it.
const WORDS = HUNDRED_WORDS.slice(0, DOCUMENT_REVIEW_ANNOTATIONS_MAX);
const FILL_TEXT = "\u20AC".repeat(ANNOTATION_MAX_CHARS);
const FILL_REPLACEMENT = "\u20AC".repeat(ANNOTATION_REPLACEMENT_MAX_CHARS);
const FILL_FIELD = "\u20AC".repeat(TEXT_FIELD_MAX_CHARS);
const BYTES_PER_EDIT = 3 * (ANNOTATION_MAX_CHARS + ANNOTATION_REPLACEMENT_MAX_CHARS);
const UNITS_PER_EDIT = ANNOTATION_MAX_CHARS + ANNOTATION_REPLACEMENT_MAX_CHARS;
const REVIEWS = 2;
const REVIEW_BYTES = REVIEWS * WORDS.length * BYTES_PER_EDIT;
// Twenty fields more than the least, so that the JSON around the texts cannot bring either limit back.
const FIELD_MARGIN = 21;
const FIELDS =
  Math.floor((BOARD_MESSAGE_MAX_BYTES - REVIEW_BYTES) / (3 * TEXT_FIELD_MAX_CHARS)) + FIELD_MARGIN;
const reviewId = (n: number) => `review-${n + 1}`;
const fieldId = (n: number) => `f${String(n + 1).padStart(3, "0")}`;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: Document reviews filled to their bounds, on the session process`, () => {
    const { start } = useEngine(engine);

    test("Answer shows the act line with the size and the limit, sends nothing, opens no socket and keeps the work; an answer to another question then goes and is collected", async () => {
      // The fixtures pass the limits they are meant to pass, whatever the contract's values.
      expect(REVIEW_BYTES).toBeLessThan(BOARD_MESSAGE_MAX_BYTES);
      expect(REVIEW_BYTES + FIELDS * 3 * TEXT_FIELD_MAX_CHARS).toBeGreaterThan(
        BOARD_MESSAGE_MAX_BYTES,
      );
      expect(
        REVIEWS * WORDS.length * UNITS_PER_EDIT + FIELDS * TEXT_FIELD_MAX_CHARS,
      ).toBeGreaterThan(DRAFT_RECORD_MAX_CHARS);
      const items = [
        ...Array.from({ length: REVIEWS }, (_, n) =>
          reviewItem(WORDS.join(" "), `Review ${n + 1}`, reviewId(n)),
        ),
        ...Array.from({ length: FIELDS }, (_, n) => ({
          type: "text-field",
          id: fieldId(n),
          props: { label: `Field ${n + 1}` },
        })),
      ];
      const base = atomAsk(items, { askId: "review-oversized-t8k4" });
      const ask = { ...base, items: [...base.items, plain("other", "Should orders be audited?")] };
      const run = await start(lifecycleScenario(ask, dist));
      const board = await openBoard(run, ["plan", "other"]);
      const dialog = board.view.getByRole("dialog");
      const frameOf = (n: number) => board.view.locator("[data-document-review]").nth(n);
      for (let n = 0; n < REVIEWS; n += 1) {
        for (const word of WORDS) {
          expect(await select(frameOf(n), word), `${word} in review ${n + 1}`).toBe(true);
          await tool(frameOf(n), "Suggest edit").click();
          await dialog.waitFor({ timeout: STEP_TIMEOUT_MS });
          await dialog.getByLabel("Replace with").fill(FILL_REPLACEMENT);
          await dialog.getByLabel("Note (optional)").fill(FILL_TEXT);
          // Escape closes the card, as "Done" does: with several reviews on the board, a card can
          // stand outside the frame's viewport, where no pointer reaches its button.
          await board.page.keyboard.press("Escape");
          await dialog.waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
        }
      }
      for (let n = 0; n < FIELDS; n += 1) {
        await card(board, "plan")
          .getByLabel(`Field ${n + 1}`, { exact: true })
          .fill(FILL_FIELD);
      }
      for (let n = 0; n < REVIEWS; n += 1) {
        expect(await frameOf(n).textContent()).toContain(`${WORDS.length} suggested edits`);
      }
      // The work is past what a reload keeps: the card says so.
      await card(board, "plan")
        .getByText(/^Too large to keep across a reload/)
        .waitFor({ timeout: STEP_TIMEOUT_MS * 4 });
      await optionOf(board, "other", "Yes").click({ timeout: STEP_TIMEOUT_MS });
      const socketsBefore = run.browser.sockets.length;
      await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
      const refusal = card(board, "plan").getByText(/^Not sent: this answer is too large/);
      await refusal.waitFor({ timeout: STEP_TIMEOUT_MS });
      expect((await refusal.textContent()) ?? "").toMatch(/\(\d+\.\d MB, at most 6 MB\)/);
      expect(sentActs(run)).toEqual([]);
      await expectNoReconnect(run);
      expect(run.browser.sockets.length).toBe(socketsBefore);
      expect(await board.banner("Connection lost, retrying").count()).toBe(0);
      // The user's work is still there, in every review.
      for (let n = 0; n < REVIEWS; n += 1) {
        expect(await frameOf(n).textContent()).toContain(`${WORDS.length} suggested edits`);
      }

      await answerOf(board, "other").click({ timeout: STEP_TIMEOUT_MS });
      await actsDone(run, 1);
      const events = answersOf(await run.session.collectJson());
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: "answer", itemId: "other", choice: ["Yes"] });
      expect(sentActs(run)).toHaveLength(1);
      expectNoCspProblem(run);
    }, 240_000);
  });
}
