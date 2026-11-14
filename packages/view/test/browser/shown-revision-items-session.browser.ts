// The items follow the revision the card shows, on the real board page and the session process, in
// each engine (document-review, task 6.19; Issues #92 and #93; spec view-and-widgets: The items
// follow the revision the card shows; design decision 15). After "Keep mine" with no reload:
// - the agent's revision removed a Tree and the Gantt over it: both render from the revision the
//   card shows, with no item error, a package added by name writes the Tree and the plan, the
//   record holds both under revision 1 and "Answer" logs the answer naming revision 1 with both;
// - the agent's revision linked a new Gantt to the edited Tree: a package added by name writes no
//   value for the new Gantt, in the draft or in the record;
// - the agent's revision added a TextField to a question holding work: the question stays loaded,
//   "Keep mine" and "Reload, losing my work" are enabled before and after the choice, and "Answer"
//   logs the answer naming revision 1.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/shown-revision-items-session.browser.ts

import { describe, expect, test } from "bun:test";
import { planAsk } from "./fixtures/widget-asks.ts";
import { checkedEvents } from "./harness/approval-board.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import type { Board } from "./harness/dom.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  card,
  lifecycleScenario,
  mirrored,
  openBoard,
  sentActs,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { treeGridOf } from "./harness/tree-grid.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();

const field = (id: string, label: string) => ({ type: "text-field", id, props: { label } });
const [plan] = planAsk.items;
const [wbs, schedule] = plan.props.items;

// The question `plan` of the UJ-2 ask with other items, and a later revision of it.
const askWith = (id: string, ...items: readonly unknown[]) => ({
  ...planAsk,
  askId: `${id}-items-s2t3`,
  items: [{ ...plan, props: { ...plan.props, items } }],
});
const revise = (run: Parameters<typeof actsDone>[0], items: readonly unknown[]) =>
  run.session.update([
    { action: "change", itemId: "plan", props: { ...plan.props, items } as unknown },
  ]);

const notice = (board: Board) =>
  card(board, "plan").locator('[data-askboard-notice="agent-change"]');
const choice = (board: Board, name: "Keep mine" | "Reload, losing my work") =>
  notice(board).getByRole("button", { name, exact: true });
const keepMine = async (board: Board): Promise<void> => {
  await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
  await choice(board, "Keep mine").click({ timeout: STEP_TIMEOUT_MS });
  await notice(board).waitFor({ state: "detached", timeout: STEP_TIMEOUT_MS });
};

// A package added by name in the Tree, after the node `after`: its row becomes current, "Add node"
// opens the new node's name, Enter commits it, and the Tree writes itself and the plans over it.
const addPackage = async (board: Board, after: string, name: string): Promise<void> => {
  const tree = treeGridOf(board);
  await tree.row(after).dispatchEvent("mousedown");
  await tree.tool("Add node").click({ timeout: STEP_TIMEOUT_MS });
  await tree.editor.waitFor({ timeout: STEP_TIMEOUT_MS });
  await board.page.keyboard.type(name);
  await board.page.keyboard.press("Enter");
};

// The values the latest mirrored record holds for question `plan`, and its revision.
const heldValues = (run: Parameters<typeof sentDrafts>[0]) => {
  const held = sentDrafts(run).at(-1)?.questions.plan;
  return { rev: held?.rev, values: (held?.values ?? {}) as Record<string, unknown> };
};
const holdsPackage = (value: unknown, name: string): boolean =>
  JSON.stringify(value ?? null).includes(name);

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: the items follow the revision the card shows, on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "the agent removed the Tree and the Gantt: Keep mine, both render with no item error, a package added by name writes both under revision 1 and Answer names revision 1 with both",
      async () => {
        const ask = askWith("removed", wbs, schedule, field("a", "First"));
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan"]);
        await addPackage(board, "portal", "Dashboards");
        await mirrored(
          run,
          (record) => holdsPackage(record.questions.plan?.values?.wbs, "Dashboards"),
          "the Tree with Dashboards",
        );
        await revise(run, [field("a", "First")]);
        await keepMine(board);
        const tree = treeGridOf(board);
        await tree.grid.waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await card(board, "plan").getByRole("alert").count()).toBe(0);
        expect(await board.view.getByLabel("First", { exact: true }).count()).toBe(1);
        await addPackage(board, "portal", "Reports");
        await mirrored(
          run,
          (record) => holdsPackage(record.questions.plan?.values?.wbs, "Reports"),
          "the Tree with Reports",
        );
        const held = heldValues(run);
        expect(held.rev).toBe(1);
        expect(Object.keys(held.values).sort()).toEqual(["schedule", "wbs"]);
        expect(holdsPackage(held.values.wbs, "Dashboards")).toBe(true);
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        const targets = (events[1]?.changes as { target: string }[] | undefined) ?? [];
        expect(targets.some(({ target }) => target.startsWith("wbs."))).toBe(true);
        expect(targets.some(({ target }) => target.startsWith("schedule."))).toBe(true);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent linked a new Gantt to the edited Tree: Keep mine, a package added by name writes the Tree and its plan and no value for the new Gantt, in the draft or in the record",
      async () => {
        const second = { ...schedule, id: "second" };
        const ask = askWith("linked", wbs, schedule);
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan"]);
        await addPackage(board, "portal", "Dashboards");
        await mirrored(
          run,
          (record) => holdsPackage(record.questions.plan?.values?.wbs, "Dashboards"),
          "the Tree with Dashboards",
        );
        await revise(run, [wbs, schedule, second]);
        await keepMine(board);
        await addPackage(board, "portal", "Reports");
        await mirrored(
          run,
          (record) => holdsPackage(record.questions.plan?.values?.wbs, "Reports"),
          "the Tree with Reports",
        );
        await Bun.sleep(QUIET_MS);
        for (const record of sentDrafts(run)) {
          expect(Object.keys(record.questions.plan?.values ?? {})).not.toContain("second");
        }
        const held = heldValues(run);
        expect(held.rev).toBe(1);
        expect(Object.keys(held.values).sort()).toEqual(["schedule", "wbs"]);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "the agent added a TextField to a question holding work: the notice's choices are enabled, Keep mine keeps the work and Answer names revision 1",
      async () => {
        const ask = askWith("added", field("a", "First"));
        const run = await start(lifecycleScenario(ask, dist));
        const board = await openBoard(run, ["plan"]);
        await board.view.getByLabel("First", { exact: true }).fill("Ada");
        await mirrored(run, (record) => record.questions.plan?.results?.a === "Ada", "a: Ada");
        await revise(run, [field("a", "First"), field("d", "Added")]);
        await notice(board).waitFor({ timeout: STEP_TIMEOUT_MS });
        await Bun.sleep(QUIET_MS);
        expect(await choice(board, "Keep mine").isEnabled()).toBe(true);
        expect(await choice(board, "Reload, losing my work").isEnabled()).toBe(true);
        expect(await card(board, "plan").getAttribute("aria-busy")).not.toBe("true");
        await keepMine(board);
        expect(await board.view.getByLabel("Added", { exact: true }).count()).toBe(0);
        await eventually(() => answerOf(board, "plan").isEnabled(), "Answer to be enabled");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 2);
        expect(sentActs(run).flatMap((command) => command.acts.map((act) => act.type))).toEqual([
          "edit-choice",
          "answer",
        ]);
        const events = checkedEvents(await run.session.collectJson());
        expect(events.map((event) => `${event.type}:${event.rev}`)).toEqual([
          "edit-choice:2",
          "answer:1",
        ]);
        expect(events[1]?.results).toEqual({ a: "Ada" });
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
