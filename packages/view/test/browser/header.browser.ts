// The view spec's "Who asked, and where", "The expected answerer in the header", "The agent pill"
// and "Agent text and paths in the header", in each engine (task 8.5, design decision 12): the
// context header's first row names who asked, "For: <name>" when shown, then Project, Directory,
// Branch and Worktree, "—" for what AskBoard does not know; agent strings and paths render as text,
// capped with an ellipsis, with the full text on hover and on keyboard focus, and controls in a
// path as visible escapes; the agent pill beside the ask pill follows the agent's waiting `collect`
// within the interaction; the header stays at the top, in its two rows, on the single-question
// board.
//
// Each scenario names who asks (`harness/asker.ts`): the session process gets the git project, the
// worktree and the agent records that make it, and the test server replays the origin and agent
// messages board-host sends for it.

import { describe, expect, test } from "bun:test";
import type { Locator } from "playwright";
import { type Asker, agentWaitsTranscript, MAIN_BRANCH, withHeader } from "./harness/asker.ts";
import {
  answerWith,
  type BoardRun,
  eventually,
  expectNoCspProblem,
  expectPageHalf,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import { replayTranscripts } from "./harness/transcripts.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const PROJECT = "order-service";
const GIT_USER = "Paola Greco";

/** The main conversation in the main checkout, for an expected user who is the git user. */
const MAIN: Asker = {
  project: PROJECT,
  gitUser: GIT_USER,
  agent: {},
  expectedUser: "  paola GRECO ",
};

/** The second code-reviewer subagent, named, in a linked worktree, for another user. */
const REVIEWER: Asker = {
  project: PROJECT,
  gitUser: GIT_USER,
  agent: {
    subagent: { type: "code-reviewer", before: 1 },
    worktree: { folder: "order-service-fix-retry", branch: "fix/retry" },
    directory: "services/orders",
  },
  agentName: "Retry review",
  expectedUser: "Marco Rossi",
};

/** An ask with no agent record. */
const UNCHECKED: Asker = { project: PROJECT, gitUser: GIT_USER };

/** A branch holding a right-to-left override, U+202E. */
const RTL: Asker = {
  project: PROJECT,
  gitUser: GIT_USER,
  agent: { worktree: { folder: "order-service-rtl", branch: "fix/\u202Eyrter" } },
};

const LONG_DIRECTORY = [
  "services",
  "order-processing-pipeline",
  "retry-and-backoff-strategies",
  "integration-tests-for-exponential-backoff-with-jitter",
].join("/");

const LONG: Asker = { project: PROJECT, gitUser: GIT_USER, agent: { directory: LONG_DIRECTORY } };

const scenarioOf = (asker: Asker) => ({
  transcript: withHeader(replayTranscripts.opening, asker),
  view: dist,
  asker,
});

const FIELDS = ["Project", "Directory", "Branch", "Worktree"] as const;

// The text the user reads: a hidden tooltip's is not, so the rendered text, not the DOM's.
const textOf = async (locator: Locator): Promise<string> =>
  // biome-ignore lint/performance/useDomNodeTextContent: the rendered text leaves hidden tooltips out.
  (await locator.innerText()).replace(/\s+/g, " ").trim();

type Row = { readonly who: string } & Readonly<Record<(typeof FIELDS)[number], string>>;

/** Row 1 once the view shows who asked: who asked, and each field's value. */
const rowOf = async (board: Board): Promise<Row> => {
  await board.field("Project").waitFor({ timeout: STEP_TIMEOUT_MS });
  const [Project, Directory, Branch, Worktree] = await Promise.all(
    FIELDS.map((label) => textOf(board.field(label))),
  );
  const who = await textOf(board.whoAndWhere.locator(":scope > span").first());
  return {
    who,
    Project: Project ?? "",
    Directory: Directory ?? "",
    Branch: Branch ?? "",
    Worktree: Worktree ?? "",
  };
};

const pillReads = (board: Board, text: string) =>
  eventually(async () => (await textOf(board.agentPill)) === text, `the agent pill "${text}"`);

const expectClean = (run: BoardRun) => {
  expectPageHalf(run);
  expectNoCspProblem(run);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: who asked, and where, and the agent pill`, () => {
    const { start } = useEngine(engine);

    test(
      "the main agent: who asked and its place, no For: for the git user, and the pill beside the ask's",
      async () => {
        const run = await start(scenarioOf(MAIN));
        const board = await run.open();
        expect(await rowOf(board)).toEqual({
          who: "Main agent",
          Project: PROJECT,
          Directory: ".",
          Branch: MAIN_BRANCH,
          Worktree: PROJECT,
        });
        expect(await board.whoAndWhere.getByText("For:").count()).toBe(0);
        await pillReads(board, "Agent: Working");
        // Both rows show on the single-question board, the agent pill in the ask pill's row.
        const ask = board.header.getByText("Waiting", { exact: true });
        expect(await ask.isVisible()).toBe(true);
        const [askBox, pillBox, rowBox] = await Promise.all([
          ask.boundingBox(),
          board.agentPill.boundingBox(),
          board.whoAndWhere.boundingBox(),
        ]);
        expect(Math.abs((askBox?.y ?? 0) - (pillBox?.y ?? -100))).toBeLessThan(8);
        expect((rowBox?.y ?? 0) + (rowBox?.height ?? 0)).toBeLessThanOrEqual((askBox?.y ?? 0) + 1);
        expectClean(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a named subagent, the second of its type, in a worktree, for another user",
      async () => {
        const run = await start(scenarioOf(REVIEWER));
        const board = await run.open();
        expect(await rowOf(board)).toEqual({
          who: "Subagent code-reviewer #2 · Retry review For: Marco Rossi",
          Project: PROJECT,
          Directory: "services/orders",
          Branch: "fix/retry",
          Worktree: "order-service-fix-retry",
        });
        expectClean(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "an unchecked ask: Agent, the project, and — for what AskBoard does not know",
      async () => {
        const run = await start(scenarioOf(UNCHECKED));
        const board = await run.open();
        expect(await rowOf(board)).toEqual({
          who: "Agent",
          Project: PROJECT,
          Directory: "—",
          Branch: "—",
          Worktree: "—",
        });
        await pillReads(board, "Agent: Working");
        expectClean(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "two asks of one project from two worktrees are told apart by their headers alone",
      async () => {
        const first = await start(scenarioOf(MAIN));
        const main = await rowOf(await first.open());
        expectClean(first);
        // One session at a time: each is its own Claude Code session's process.
        await first.session.close();
        const second = await start(scenarioOf(REVIEWER));
        const reviewer = await rowOf(await second.open());
        expect(main.Project).toBe(reviewer.Project);
        expect(main.Branch).not.toBe(reviewer.Branch);
        expect(main.Worktree).not.toBe(reviewer.Worktree);
        expectClean(second);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a right-to-left override in a branch shows as a visible escape, and the row keeps its order",
      async () => {
        const run = await start(scenarioOf(RTL));
        const board = await run.open();
        const branch = board.field("Branch");
        await branch.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await textOf(branch)).toBe("fix/\\u202Eyrter");
        expect(await textOf(board.whoAndWhere)).not.toContain("\u202E");
        const shownEscape = branch.getByText("\\u202E", { exact: true });
        expect(await shownEscape.evaluate((element) => element.className)).toContain(
          "text-muted-foreground",
        );
        // The fields still read left to right: Branch's value, then the Worktree label.
        const worktreeLabel = board.whoAndWhere
          .locator("dt")
          .getByText("Worktree", { exact: true });
        const [value, next] = await Promise.all([
          branch.boundingBox(),
          worktreeLabel.boundingBox(),
        ]);
        expect((value?.x ?? 0) + (value?.width ?? 0)).toBeLessThanOrEqual((next?.x ?? 0) + 1);
        expect(await textOf(board.field("Worktree"))).toBe("order-service-rtl");
        expectClean(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a long directory ends in an ellipsis, its full path shown on hover and on keyboard focus",
      async () => {
        const run = await start(scenarioOf(LONG));
        const board = await run.open();
        const directory = board.field("Directory");
        await directory.waitFor({ timeout: STEP_TIMEOUT_MS });
        const shown = directory.locator(".truncate").first();
        const cut = await shown.evaluate((element) => ({
          clipped: element.scrollWidth > element.clientWidth,
          ellipsis: getComputedStyle(element).textOverflow,
          focusable: element.tabIndex,
        }));
        expect(cut).toEqual({ clipped: true, ellipsis: "ellipsis", focusable: 0 });
        const tooltip = directory.getByRole("tooltip");
        expect(await tooltip.isVisible()).toBe(false);
        await shown.hover();
        await tooltip.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        expect(await textOf(tooltip)).toBe(LONG_DIRECTORY);
        await board.header.getByRole("heading").hover();
        await tooltip.waitFor({ state: "hidden", timeout: STEP_TIMEOUT_MS });
        await shown.focus();
        await tooltip.waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
        expect(await shown.getAttribute("aria-describedby")).toBe(await tooltip.getAttribute("id"));
        expectClean(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the pill reads waiting while the agent waits on the ask, and working once the answer returns",
      async () => {
        const run = await start({
          transcript: agentWaitsTranscript(MAIN),
          view: dist,
          asker: MAIN,
        });
        const board = await run.open();
        await pillReads(board, "Agent: Working");
        await run.session.agentWaits();
        await pillReads(board, "Agent: Waiting for your answer");
        const clicked = await answerWith(board, "PostgreSQL");
        await pillReads(board, "Agent: Working");
        expectPageHalf(run, clicked);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the header stays at the top on scroll, both rows in view",
      async () => {
        const run = await start(scenarioOf(MAIN));
        const board = await run.open();
        await rowOf(board);
        await board.page.setViewportSize({ width: 1280, height: 240 });
        const view = await board.viewFrame();
        const placed = await view.evaluate(async () => {
          window.scrollTo(0, document.documentElement.scrollHeight);
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const box = (selector: string) =>
            document.querySelector(selector)?.getBoundingClientRect();
          const header = box("header");
          const row = box('[data-askboard-header="who-and-where"]');
          const pill = box('[role="status"]');
          return {
            scrolled: window.scrollY,
            top: header?.top,
            // Row 1 on top, then the pill's row under it, both inside the header.
            rows:
              row !== undefined &&
              pill !== undefined &&
              header !== undefined &&
              row.top === header.top &&
              pill.top >= row.bottom &&
              pill.bottom <= header.bottom,
          };
        });
        expect(placed).toEqual({ scrolled: expect.any(Number), top: 0, rows: true });
        expect(placed.scrolled).toBeGreaterThan(0);
        expect(await board.whoAndWhere.isVisible()).toBe(true);
        expect(await board.agentPill.isVisible()).toBe(true);
        expectClean(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
