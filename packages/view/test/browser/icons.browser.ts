// The view's icons, in each engine (icon-set, task 2.1; view-and-widgets spec: Icons beside their
// labels, Accessible names of icons, One icon set in one chunk): the header's next-open jump and a
// reference's hint draw an icon after their text, hidden from assistive technology; the outline's
// reply badge and agent-change flag are images named in the board's language; the date field's
// calendar button keeps its name over a hidden icon; every icon takes the text colour of its
// element, in the light and the dark theme; and a Snapshot opened offline draws them as inline SVG
// with no request and no CSP violation. The icon-only buttons draw their icon as a full square (#254).

import { describe, expect, test } from "bun:test";
import type { Browser } from "playwright";
import { atomAsk } from "./fixtures/atom-documents.ts";
import { sectionsAsk } from "./fixtures/lifecycle-asks.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { type Board, pickTheme } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  buttonOf,
  card,
  labelText,
  lifecycleScenario,
  openBoard,
  optionOf,
} from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const GITHUB = "https://github.com/acme/pay/pull/12";

const plainQuestion = (id: string, text: string) => ({
  type: "question",
  id,
  props: { text, header: id, options: [{ label: "Yes" }, { label: "No" }] },
});

const area = (id: string, title: string, items: readonly unknown[]) => ({
  type: "area",
  id,
  props: { title, items },
});

/** Sections whose first question holds a GITHUB and a FILE reference, for the hint. */
const referenceAsk = (askId: string, language: "en-US" | "it-IT" = "en-US") => ({
  askId,
  title: "References",
  language,
  items: [
    area("scope", "Scope", [
      {
        type: "question",
        id: "fix",
        props: {
          text: "Is the fix right?",
          options: [{ label: "Yes" }, { label: "No" }],
          items: [
            { type: "reference", id: "fix-pr", props: { url: GITHUB } },
            { type: "reference", id: "fix-src", props: { pointer: "src/retry.ts#L1" } },
          ],
        },
      },
    ]),
    area("data", "Data", [plainQuestion("export", "Export every night?")]),
  ],
});

/** A question with a GITHUB reference, for a hint beside the outline's marks. */
const withReference = (question: ReturnType<typeof plainQuestion>) => ({
  ...question,
  props: {
    ...question.props,
    items: [{ type: "reference", id: "first-pr", props: { url: GITHUB } }],
  },
});

/** Six questions in one area and one in another, so that the first can scroll out of view. */
const longSections = (askId: string, language: "en-US" | "it-IT") => ({
  askId,
  title: "Long sections",
  language,
  items: [
    area(
      "first-area",
      "First",
      ["first", "second", "third", "fourth", "fifth", "sixth"].map((id) =>
        id === "first"
          ? withReference(plainQuestion(id, `Is the ${id} step needed?`))
          : plainQuestion(id, `Is the ${id} step needed?`),
      ),
    ),
    area("second-area", "Second", [plainQuestion("last", "Is the last step needed?")]),
  ],
});

/** The icon `svg`s inside a locator. */
const svgsIn = (holder: ReturnType<Board["view"]["locator"]>) => holder.locator("svg");

/** Each svg's computed stroke against the computed colour of the element that holds it. */
const strokeFollowsText = (holder: ReturnType<Board["view"]["locator"]>) =>
  svgsIn(holder).evaluateAll((svgs) =>
    svgs.map((svg) => ({
      stroke: getComputedStyle(svg).stroke,
      color: getComputedStyle(svg.parentElement as Element).color,
    })),
  );

const reportedInView = (board: Board, id: string, shown: boolean): Promise<void> =>
  board.view
    .locator(`[data-askboard-question="${id}"][data-askboard-in-view="${shown}"]`)
    .waitFor({ state: "attached", timeout: STEP_TIMEOUT_MS });

/**
 * Brings "first" to an unread reply and an agent change while it is out of view: the outline then
 * shows the reply badge and the agent-change flag on its entry.
 */
const reachMarks = async (
  run: Parameters<typeof actsDone>[0],
  board: Board,
  language: "en-US" | "it-IT",
): Promise<void> => {
  const send = language === "it-IT" ? "Invia" : "Send";
  const ask = language === "it-IT" ? "Chiedi un chiarimento" : "Ask a follow-up";
  await optionOf(board, "first", "Yes").click();
  await buttonOf(board, "first", ask).click();
  await card(board, "first").getByRole("textbox").last().fill("Is it needed?");
  await buttonOf(board, "first", send).click();
  await actsDone(run, 1);
  await card(board, "last").scrollIntoViewIfNeeded();
  await reportedInView(board, "first", false);
  const { events } = await run.session.collect();
  const followUp = events.findLast(
    (event) => event.type === "follow-up" && event.itemId === "first",
  );
  if (followUp === undefined) throw new Error("no follow-up on first");
  await run.session.update([
    { action: "reply", itemId: "first", followUp: followUp.cursor, text: "Yes." },
    {
      action: "change",
      itemId: "first",
      props: { text: "Is the first step still needed?" },
    },
  ]);
};

const LANGUAGES = [
  {
    language: "en-US",
    jump: "Next to do",
    replies: "1 new reply",
    changed: "The agent updated this",
  },
  {
    language: "it-IT",
    jump: "Prossima da fare",
    replies: "1 nuova risposta",
    changed: "Aggiornata dall'agente",
  },
] as const;

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  for (const { language, jump, replies, changed } of LANGUAGES) {
    describe(`${engine}: icons beside their labels, ${language}`, () => {
      const { start } = useEngine(engine);

      test(
        "the header's jump reads its text alone, is named by it, and ends with a hidden arrow",
        async () => {
          const ask = { ...sectionsAsk, askId: `sections-icons-${language}`, language };
          const run = await start(lifecycleScenario(ask, dist));
          const board = await openBoard(run, ["region", "mobile", "export", "flag"]);
          const button = board.header.getByRole("button", { name: jump, exact: true });
          await button.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await labelText(button)).toBe(jump);
          const svgs = svgsIn(button);
          expect(await svgs.count()).toBe(1);
          expect(await svgs.first().getAttribute("aria-hidden")).toBe("true");
          expect(
            await button.evaluate((element) => element.lastElementChild?.tagName.toLowerCase()),
          ).toBe("svg");
          // The arrow points right: one label, no direction glyph (answering-flow-guidance, D11).
          expect(await svgs.first().getAttribute("class")).toContain("lucide-arrow-right");
        },
        TEST_TIMEOUT_MS,
      );

      test(
        "the outline's reply badge and agent-change flag are images named in the board's language",
        async () => {
          const run = await start(
            lifecycleScenario(longSections(`outline-${language}`, language), dist),
          );
          const ids = ["first", "second", "third", "fourth", "fifth", "sixth", "last"];
          const board = await openBoard(run, ids);
          await reachMarks(run, board, language);
          const entry = board.view.locator('[data-askboard-outline="first"]');
          const badge = entry.getByRole("img", { name: replies, exact: true });
          await badge.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect((await badge.textContent())?.trim()).toBe("1");
          expect(await svgsIn(badge).count()).toBe(1);
          const flag = entry.getByRole("img", { name: changed, exact: true });
          await flag.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await svgsIn(flag).count()).toBe(1);
          expect(await flag.textContent()).toBe("");
          const name = await entry.evaluate((element) => element.textContent);
          expect(name).not.toContain("↩");
          expect(name).not.toContain("↻");
          expect(
            await board.view
              .getByRole("navigation", { name: language === "it-IT" ? "Indice" : "Outline" })
              .getByRole("button", { name: new RegExp(`${replies}.*${changed}`) })
              .count(),
          ).toBe(1);
        },
        TEST_TIMEOUT_MS,
      );
    });
  }

  describe(`${engine}: icon-only buttons`, () => {
    const { start } = useEngine(engine);

    test(
      "Keys, Theme, Settings and a card's More each draw their icon as a full square (#254)",
      async () => {
        const ask = { ...sectionsAsk, askId: "sections-icon-buttons" };
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["region", "mobile", "export", "flag"]);
        const buttons = [
          board.header.getByRole("button", { name: "Keys", exact: true }),
          board.header.getByRole("button", { name: "Theme", exact: true }),
          board.header.getByRole("button", { name: "Settings", exact: true }),
          card(board, "region").getByRole("button", { name: "More", exact: true }),
        ];
        for (const button of buttons) {
          await button.waitFor({ timeout: STEP_TIMEOUT_MS });
          const box = await svgsIn(button).first().boundingBox();
          if (box === null) throw new Error("an icon-only button draws no icon");
          // `size-4`: one rem square, never squeezed by the padding of a labelled button.
          expect(box.width).toBeGreaterThan(8);
          expect(box.width).toBe(box.height);
        }
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: icons of the context and the date field`, () => {
    const { start } = useEngine(engine);

    test(
      "a GITHUB reference's hint ends with a hidden external-link icon, a FILE reference's has none",
      async () => {
        const run = await start(lifecycleScenario(referenceAsk("references-icons-r1"), dist));
        const board = await openBoard(run, ["fix", "export"]);
        const hints = board.view.locator('[data-context="reference"] [data-context-part="hint"]');
        await hints.first().waitFor({ timeout: STEP_TIMEOUT_MS });
        const github = hints.filter({ hasText: "opens in browser" });
        const file = hints.filter({ hasText: "opens in a reading panel" });
        expect((await github.textContent())?.trim()).toBe("opens in browser");
        expect(await svgsIn(github).count()).toBe(1);
        expect(await svgsIn(github).first().getAttribute("aria-hidden")).toBe("true");
        expect(await svgsIn(file).count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the calendar button keeps its name over a hidden icon",
      async () => {
        const ask = atomAsk([{ type: "date-field", id: "start", props: { label: "Start" } }], {
          language: "en-US",
        });
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan"]);
        const button = board.view.getByRole("button", { name: "Choose a date" });
        await button.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await svgsIn(button).count()).toBe(1);
        expect(await svgsIn(button).first().getAttribute("aria-hidden")).toBe("true");
      },
      TEST_TIMEOUT_MS,
    );

    for (const theme of ["Light", "Dark"] as const) {
      test(
        `each icon takes the text colour of its element in the ${theme.toLowerCase()} theme`,
        async () => {
          const run = await start(
            lifecycleScenario(longSections(`colours-icons-${theme}`, "en-US"), dist),
          );
          const ids = ["first", "second", "third", "fourth", "fifth", "sixth", "last"];
          const board = await openBoard(run, ids);
          await reachMarks(run, board, "en-US");
          const entry = board.view.locator('[data-askboard-outline="first"]');
          await entry
            .getByRole("img", { name: "The agent updated this", exact: true })
            .waitFor({ timeout: STEP_TIMEOUT_MS });
          await entry
            .getByRole("img", { name: "1 new reply", exact: true })
            .waitFor({ timeout: STEP_TIMEOUT_MS });
          await pickTheme(board.view, theme);
          await board.view
            .locator(theme === "Dark" ? "html.dark" : "html:not(.dark)")
            .waitFor({ state: "attached" });
          const jumpButton = board.header.locator("[data-askboard-next-to-do]");
          const hint = board.view
            .locator('[data-context-part="hint"]')
            .filter({ hasText: "opens in browser" });
          const holders = [
            jumpButton,
            hint,
            entry.getByRole("img", { name: "1 new reply", exact: true }),
            entry.getByRole("img", { name: "The agent updated this", exact: true }),
          ];
          expect(holders).toHaveLength(4);
          for (const holder of holders) {
            const pairs = await strokeFollowsText(holder);
            expect(pairs).toHaveLength(1);
            for (const pair of pairs) {
              expect(pair.stroke).not.toBe("none");
              expect(pair.stroke).toBe(pair.color);
            }
          }
        },
        TEST_TIMEOUT_MS,
      );
    }
  });

  describe(`${engine}: icons in a Snapshot, offline`, () => {
    const { start } = useEngine(engine);

    test(
      "the jump and a reference's hint render as inline SVG with every request blocked and no CSP violation",
      async () => {
        const run = await start(lifecycleScenario(referenceAsk("snapshot-icons-s1"), dist));
        await openBoard(run, ["fix", "export"]);
        const taken = await run.session.snapshot();
        await run.session.exit();
        const browser: Browser = await launchEngine(engine);
        try {
          const context = await browser.newContext({ offline: true });
          await context.addInitScript(() => {
            document.addEventListener("securitypolicyviolation", (event) => {
              console.error(`CSP ${event.violatedDirective} ${event.blockedURI}`);
            });
          });
          const page = await context.newPage();
          const violations: string[] = [];
          const requests: string[] = [];
          page.on("console", (message) => {
            if (message.text().startsWith("CSP ")) violations.push(message.text());
          });
          page.on("request", (request) => {
            if (!request.url().startsWith("file:") && !request.url().startsWith("data:"))
              requests.push(request.url());
          });
          await page.goto(`file://${taken.path}`);
          const hint = page
            .locator('[data-context-part="hint"]')
            .filter({ hasText: "opens in browser" });
          await hint.waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await hint.locator("svg").count()).toBe(1);
          const jumpButton = page.locator("[data-askboard-next-to-do]");
          expect(await jumpButton.locator("svg").count()).toBe(1);
          await page.waitForLoadState("networkidle");
          expect(requests).toEqual([]);
          expect(violations).toEqual([]);
          await context.close();
        } finally {
          await browser.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
}
