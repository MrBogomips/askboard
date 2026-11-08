// The PickField in each engine (form-widget, task 3.3; view-and-widgets spec: The PickField, The
// PickField's filter, Forms read-only and in Snapshots, Form strings; design decision 4): a single
// pick on AskBoard's own radio group (choice-documented-activation: the arrow keys move the focus
// only, Space or a click picks) and a "Clear", a multiple pick on checkboxes with Space, the counts'
// field errors, the filter over a long list that hides options and never a pick and never reaches
// the draft, a required pick blocking "Answer", an Italian board, nothing in the DOM with a `style`
// attribute, and, on the session process, an answer returning option IDs by item ID and a field
// read-only once the ask closes. At DESIGN's 1,280-pixel floor, each act by keyboard.
//
// Run one engine by hand: ASKBOARD_E2E_ENGINES=webkit ASKBOARD_E2E_TARGET=session-process bun test ./packages/view/test/browser/pick-field.browser.ts

import { describe, expect, test } from "bun:test";
import type { FrameLocator, Locator } from "playwright";
import { atomAsk, atomDocument } from "./fixtures/atom-documents.ts";
import { plan } from "./fixtures/tree-documents.ts";
import {
  eventually,
  expectNoCspProblem,
  QUIET_MS,
  STEP_TIMEOUT_MS,
  TEST_TIMEOUT_MS,
  useEngine,
} from "./harness/board-test.ts";
import { draftHolds } from "./harness/draft-results.ts";
import { enginesFrom } from "./harness/engines.ts";
import {
  actsDone,
  answerOf,
  lifecycleScenario,
  openBoard,
  sentDrafts,
} from "./harness/lifecycle-test.ts";
import { tabIntoGroup } from "./harness/tab-stops.ts";
import { readyIn } from "./harness/tree-steps.ts";
import { readViewBuild } from "./harness/view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./harness/widget-host-test.ts";

const dist = await readViewBuild();

const REGION = {
  type: "pick-field",
  id: "region",
  props: {
    label: "Region",
    options: [
      { id: "eu", label: "Europe", description: "Includes the UK." },
      { id: "us", label: "North America" },
      { id: "apac", label: "Asia-Pacific" },
    ],
  },
};
const tags = (extra: Record<string, unknown> = {}) => ({
  type: "pick-field",
  id: "tags",
  props: {
    label: "Tags",
    multiple: true,
    options: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
      { id: "c", label: "Gamma" },
    ],
    ...extra,
  },
});
const NAMES = [
  "Argentina",
  "Australia",
  "Austria",
  "Belgium",
  "Brazil",
  "Canada",
  "Chile",
  "China",
  "Denmark",
  "Egypt",
  "Finland",
  "France",
  "Germany",
  "Greece",
  "India",
  "Ireland",
  "Italy",
  "Japan",
  "Kenya",
  "Mexico",
  "Norway",
  "Peru",
  "Poland",
  "Portugal",
  "Spain",
  "Sweden",
  "Turkey",
  "Ukraine",
  "Vietnam",
  "Zambia",
];
const COUNTRIES = {
  type: "pick-field",
  id: "country",
  props: {
    label: "Country",
    options: NAMES.map((label, at) => ({ id: `c${at}`, label })),
  },
};
// The option IDs are the names' positions: no two clash.
const idOf = (name: string) => `c${NAMES.indexOf(name)}`;
const ITALY = idOf("Italy");
const notify = { type: "toggle", id: "notify", props: { label: "Notify me" } };

const holding = (run: WidgetHostRun, itemId: string, expected: unknown, what: string) =>
  eventually(() => draftHolds(run.drafts, "plan", itemId, expected), what);
const errorOf = (view: FrameLocator, itemId: string) => view.locator(`[id="${itemId}:error"]`);
// The question holds its own options (the Choice's radios), so each helper names the field.
const fieldOf = (view: FrameLocator, itemId: string) =>
  view.locator(`[data-askboard-field="${itemId}"]`);
const radio = (view: FrameLocator, name: string, itemId?: string) =>
  (itemId === undefined ? view : fieldOf(view, itemId)).getByRole("radio", { name, exact: true });
const box = (view: FrameLocator, name: string) => view.getByRole("checkbox", { name, exact: true });
const focused = (locator: Locator) =>
  locator.evaluate((element) => element === element.ownerDocument.activeElement);
const hintOf = async (run: WidgetHostRun, button: Locator): Promise<string | undefined> => {
  const id = await button.getAttribute("aria-describedby");
  return id === null
    ? undefined
    : ((await run.board.view.locator(`[id="${id}"]`).textContent()) ?? undefined);
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a single PickField`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "Tab picks nothing, the down arrow moves the focus only, Space picks the focused option, Clear returns it to unset and focus to the first option",
      async () => {
        const run = await host(dist, atomDocument([REGION]));
        await readyIn(run);
        const { view, page } = run.board;
        const group = view.getByRole("radiogroup", { name: "Region" });
        expect(await fieldOf(view, "region").getByRole("radio").count()).toBe(3);
        const entered = await tabIntoGroup(run.board, plan.props.text, group);
        expect(entered).toContain("Europe");
        await Bun.sleep(QUIET_MS);
        expect(
          await fieldOf(view, "region").locator('[role="radio"][aria-checked="true"]').count(),
        ).toBe(0);
        expect(draftHolds(run.drafts, "plan", "region", undefined)).toBe(true);
        expect(await view.getByRole("button", { name: "Clear", exact: true }).count()).toBe(0);
        await page.keyboard.press("ArrowDown");
        await eventually(() => focused(radio(view, "North America")), "focus on North America");
        await Bun.sleep(QUIET_MS);
        expect(draftHolds(run.drafts, "plan", "region", undefined)).toBe(true);
        expect(await radio(view, "North America").getAttribute("aria-checked")).toBe("false");
        await page.keyboard.press("Space");
        await holding(run, "region", "us", "Space to pick the option the arrow moved to");
        expect(await radio(view, "North America").getAttribute("aria-checked")).toBe("true");
        await page.keyboard.press("Tab");
        const clear = view.getByRole("button", { name: "Clear", exact: true });
        await eventually(() => focused(clear), "focus on Clear");
        await page.keyboard.press("Enter");
        await holding(run, "region", undefined, "the draft to hold no result");
        await eventually(() => focused(radio(view, "Europe")), "focus back on the first option");
        expect(await clear.count()).toBe(0);
        await page.keyboard.press("Space");
        await holding(run, "region", "eu", "Space to pick the focused option");
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a click picks, picking another replaces it, and the option labels and descriptions are shown as text",
      async () => {
        const run = await host(dist, atomDocument([REGION, notify]));
        await readyIn(run);
        const { view } = run.board;
        expect(await view.getByText("Includes the UK.").isVisible()).toBe(true);
        await radio(view, "Asia-Pacific").click();
        await holding(run, "region", "apac", "the draft to hold apac");
        await radio(view, "Europe").click();
        await holding(run, "region", "eu", "the draft to hold eu");
        expect(await radio(view, "Asia-Pacific").getAttribute("aria-checked")).toBe("false");
        expect(await run.board.answer.isEnabled()).toBe(true);
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a required pick keeps Answer disabled, described by the field, until one is picked",
      async () => {
        const required = { ...REGION, props: { ...REGION.props, required: true } };
        const run = await host(dist, atomDocument([required, notify]));
        await readyIn(run);
        const { view, page } = run.board;
        const label = view.locator('[data-askboard-field="region"] label');
        expect((await label.textContent())?.replace(/\s+/g, " ")).toBe("Region (required)");
        expect(
          await view
            .getByRole("radiogroup", { name: "Region (required)" })
            .getAttribute("aria-required"),
        ).toBe("true");
        expect(await errorOf(view, "region").count()).toBe(0);
        await view.getByRole("switch", { name: "Notify me" }).focus();
        await page.keyboard.press("Space");
        await holding(run, "notify", true, "the draft to hold the switch");
        expect(await run.board.answer.isDisabled()).toBe(true);
        expect(await hintOf(run, run.board.answer)).toBe("Complete Region first.");
        await radio(view, "Europe").click();
        await eventually(() => run.board.answer.isEnabled(), "Answer to be enabled");
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: a multiple PickField`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "Space toggles a checkbox, the result keeps the options' order, and the last unpicked leaves no result",
      async () => {
        const run = await host(dist, atomDocument([tags()]));
        await readyIn(run);
        const { view, page } = run.board;
        expect(await view.getByRole("checkbox").count()).toBe(3);
        expect(await view.getByRole("button", { name: "Clear", exact: true }).count()).toBe(0);
        await box(view, "Gamma").focus();
        await page.keyboard.press("Space");
        await holding(run, "tags", ["c"], "the draft to hold c");
        await box(view, "Alpha").focus();
        await page.keyboard.press("Space");
        await holding(run, "tags", ["a", "c"], "the draft to hold a and c in the options' order");
        await page.keyboard.press("Enter");
        await Bun.sleep(QUIET_MS);
        expect(draftHolds(run.drafts, "plan", "tags", ["a", "c"])).toBe(true);
        await page.keyboard.press("Space");
        await box(view, "Gamma").focus();
        await page.keyboard.press("Space");
        await holding(run, "tags", undefined, "no result once none is picked");
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "too few picks show Pick at least 2 and disable Answer, and one more clears both; too many show Pick at most",
      async () => {
        const run = await host(dist, atomDocument([tags({ minItems: 2, maxItems: 2 })]));
        await readyIn(run);
        const { view, page } = run.board;
        await box(view, "Alpha").focus();
        await page.keyboard.press("Space");
        await holding(run, "tags", ["a"], "the draft to hold a");
        expect(await errorOf(view, "tags").textContent()).toBe("Pick at least 2.");
        expect(await run.board.answer.isDisabled()).toBe(true);
        await box(view, "Beta").focus();
        await page.keyboard.press("Space");
        await holding(run, "tags", ["a", "b"], "the draft to hold a and b");
        expect(await errorOf(view, "tags").count()).toBe(0);
        expect(await run.board.answer.isEnabled()).toBe(true);
        await box(view, "Gamma").focus();
        await page.keyboard.press("Space");
        await holding(run, "tags", ["a", "b", "c"], "the draft to hold all three");
        expect(await errorOf(view, "tags").textContent()).toBe("Pick at most 2.");
        expect(await run.board.answer.isDisabled()).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the filter`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "30 options show a filter: it matches the label ignoring case, a hidden pick stays picked, and its text is never in the draft",
      async () => {
        const run = await host(dist, atomDocument([COUNTRIES]));
        await readyIn(run);
        const { view, page } = run.board;
        const filter = view.getByLabel("Filter the options");
        expect(await fieldOf(view, "country").getByRole("radio").count()).toBe(30);
        await radio(view, "Italy").click();
        await holding(run, "country", ITALY, "the draft to hold Italy's ID");
        await filter.focus();
        await page.keyboard.type("FRAN");
        await eventually(
          async () => (await fieldOf(view, "country").getByRole("radio").count()) === 1,
          "one option",
        );
        expect(await radio(view, "France").isVisible()).toBe(true);
        expect(await radio(view, "Italy").count()).toBe(0);
        expect(draftHolds(run.drafts, "plan", "country", ITALY)).toBe(true);
        await page.keyboard.press("Enter");
        await Bun.sleep(QUIET_MS);
        expect(JSON.stringify(run.drafts).toLowerCase()).not.toContain("fran");
        expect(run.messages.map((message) => message.type)).toEqual(["ready"]);
        await filter.fill("zzz");
        await view.getByText("No option matches.").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await fieldOf(view, "country").getByRole("radio").count()).toBe(0);
        await filter.fill("");
        await eventually(
          async () => (await fieldOf(view, "country").getByRole("radio").count()) === 30,
          "all 30",
        );
        expect(await radio(view, "Italy").getAttribute("aria-checked")).toBe("true");
        expect(draftHolds(run.drafts, "plan", "country", ITALY)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a pick the filter hides keeps the draft: Tab into the options lands on the first one shown, which is not picked",
      async () => {
        const run = await host(dist, atomDocument([COUNTRIES]));
        await readyIn(run);
        const { view, page } = run.board;
        await radio(view, "Italy").click();
        await holding(run, "country", ITALY, "the draft to hold Italy's ID");
        await view.getByLabel("Filter the options").focus();
        await page.keyboard.type("FRAN");
        await eventually(
          async () => (await fieldOf(view, "country").getByRole("radio").count()) === 1,
          "one option",
        );
        await page.keyboard.press("Tab");
        await eventually(() => focused(radio(view, "France")), "focus on the first option shown");
        expect(await radio(view, "France").getAttribute("aria-checked")).toBe("false");
        await Bun.sleep(QUIET_MS);
        expect(draftHolds(run.drafts, "plan", "country", ITALY)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "under a filter the arrow keys, Home and End move among the options shown and wrap, and the draft stays",
      async () => {
        const run = await host(dist, atomDocument([COUNTRIES]));
        await readyIn(run);
        const { view, page } = run.board;
        await radio(view, "Italy").click();
        await holding(run, "country", ITALY, "the draft to hold Italy's ID");
        await view.getByLabel("Filter the options").focus();
        await page.keyboard.type("land");
        await eventually(
          async () => (await fieldOf(view, "country").getByRole("radio").count()) === 3,
          "three options",
        );
        await page.keyboard.press("Tab");
        await eventually(() => focused(radio(view, "Finland")), "focus on the first shown");
        await page.keyboard.press("End");
        await eventually(() => focused(radio(view, "Poland")), "End to the last shown");
        await page.keyboard.press("ArrowDown");
        await eventually(() => focused(radio(view, "Finland")), "ArrowDown wraps to the first");
        await page.keyboard.press("ArrowUp");
        await eventually(() => focused(radio(view, "Poland")), "ArrowUp wraps to the last");
        await page.keyboard.press("ArrowUp");
        await eventually(() => focused(radio(view, "Ireland")), "ArrowUp to the one before");
        await page.keyboard.press("Home");
        await eventually(() => focused(radio(view, "Finland")), "Home to the first shown");
        for (const name of ["Finland", "Ireland", "Poland"]) {
          expect(await radio(view, name).getAttribute("aria-checked")).toBe("false");
        }
        await Bun.sleep(QUIET_MS);
        expect(draftHolds(run.drafts, "plan", "country", ITALY)).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "a multiple pick filters too, and picking under a filter keeps the hidden picks in the options' order",
      async () => {
        const many = {
          ...COUNTRIES,
          id: "countries",
          props: { ...COUNTRIES.props, multiple: true, label: "Countries" },
        };
        const run = await host(dist, atomDocument([many]));
        await readyIn(run);
        const { view, page } = run.board;
        await box(view, "Spain").click();
        await view.getByLabel("Filter the options").fill("ger");
        await eventually(async () => (await view.getByRole("checkbox").count()) === 1, "one box");
        await box(view, "Germany").focus();
        await page.keyboard.press("Space");
        await holding(
          run,
          "countries",
          [idOf("Germany"), idOf("Spain")].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))),
          "both picks, in the options' order",
        );
      },
      TEST_TIMEOUT_MS,
    );

    test(
      "ten options show no filter",
      async () => {
        const ten = {
          ...COUNTRIES,
          props: { ...COUNTRIES.props, options: COUNTRIES.props.options.slice(0, 10) },
        };
        const run = await host(dist, atomDocument([ten]));
        await readyIn(run);
        expect(await run.board.view.getByLabel("Filter the options").count()).toBe(0);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: the PickField's DOM`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "no element carries a style attribute, and a 200-character label and description stay inside the card at 1,280 pixels",
      async () => {
        const long = "x".repeat(200);
        const wide = {
          ...REGION,
          props: {
            label: long,
            description: long,
            options: [
              { id: "one", label: long, description: long },
              { id: "two", label: "Two" },
            ],
          },
        };
        const run = await host(dist, atomDocument([wide, tags()]));
        await readyIn(run);
        const { view } = run.board;
        const styled = await view.locator('[data-askboard-field="region"] [style]').count();
        expect(styled).toBe(0);
        expect(await view.locator('[data-askboard-field="tags"] [style]').count()).toBe(0);
        const box = await view.locator('[data-askboard-field="region"]').evaluate((element) => ({
          scroll: element.scrollWidth,
          client: element.clientWidth,
          parent: element.parentElement?.clientWidth ?? 0,
        }));
        expect(box.scroll).toBeLessThanOrEqual(box.client);
        expect(box.client).toBeLessThanOrEqual(box.parent);
        expect(run.browser.cspProblems()).toEqual([]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: an Italian board`, () => {
    const { host } = useWidgetHost(engine);

    test(
      "the mark, Clear, the filter, its empty text and the counts' errors are Italian",
      async () => {
        const required = { ...COUNTRIES, props: { ...COUNTRIES.props, required: true } };
        const run = await host(dist, atomDocument([required, tags({ minItems: 2 })], "it-IT"));
        await readyIn(run);
        const { view } = run.board;
        expect(
          (await view.locator('[data-askboard-field="country"] label').textContent())?.replace(
            /\s+/g,
            " ",
          ),
        ).toBe("Country (obbligatorio)");
        await radio(view, "Italy").click();
        await view.getByRole("button", { name: "Cancella", exact: true }).waitFor();
        await view.getByLabel("Filtra le opzioni").fill("zzz");
        await view.getByText("Nessuna opzione corrisponde.").waitFor({ timeout: STEP_TIMEOUT_MS });
        await box(view, "Alpha").click();
        await eventually(
          async () => (await errorOf(view, "tags").textContent()) === "Scegline almeno 2.",
          "the Italian counts' error",
        );
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe(`${engine}: on the session process`, () => {
    const { start } = useEngine(engine);

    test(
      "the answer returns option IDs by item ID, and once the ask closes the picks are checked and the controls disabled with no Clear or filter",
      async () => {
        const run = await start(lifecycleScenario(atomAsk([COUNTRIES, tags(), REGION]), dist));
        const board = await openBoard(run, ["plan"]);
        const { view } = board;
        await radio(view, "Italy").click();
        await box(view, "Gamma").click();
        await box(view, "Alpha").click();
        await radio(view, "North America").click();
        await eventually(
          () => draftHolds(sentDrafts(run), "plan", "tags", ["a", "c"]),
          "the draft to hold the picks",
        );
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await board.receipt("sent").waitFor({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const { events } = await run.session.collect();
        expect(events[0]?.results).toEqual({ country: ITALY, tags: ["a", "c"], region: "us" });
        await board.receipt("delivered to the agent").waitFor({ timeout: STEP_TIMEOUT_MS });
        expect(await radio(view, "Italy").getAttribute("aria-checked")).toBe("true");
        await run.session.update([{ action: "close" }]);
        await board
          .banner(/closed/i)
          .first()
          .waitFor({ timeout: STEP_TIMEOUT_MS });
        await eventually(() => radio(view, "Italy").isDisabled(), "the radios to be disabled");
        expect(await radio(view, "Italy").getAttribute("aria-checked")).toBe("true");
        expect(await box(view, "Alpha").getAttribute("aria-checked")).toBe("true");
        expect(await box(view, "Alpha").isDisabled()).toBe(true);
        expect(await box(view, "Beta").getAttribute("aria-checked")).toBe("false");
        expect(await view.getByRole("button", { name: "Clear", exact: true }).count()).toBe(0);
        expect(await view.getByLabel("Filter the options").count()).toBe(0);
        const drafts = sentDrafts(run).length;
        await radio(view, "Spain")
          .click({ force: true, noWaitAfter: true })
          .catch(() => undefined);
        await Bun.sleep(QUIET_MS);
        expect(await radio(view, "Italy").getAttribute("aria-checked")).toBe("true");
        expect(sentDrafts(run).length).toBe(drafts);
        expectNoCspProblem(run);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
