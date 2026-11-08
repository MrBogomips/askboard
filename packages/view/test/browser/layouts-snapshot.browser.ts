// A Snapshot of an answered arranged question, in each engine (layouts, task 4.2; spec
// view-and-widgets: Layouts in Snapshots): the agent takes the Snapshot after the user's answer, the
// session process exits, and the file opens from `file://` offline with no CSP violation. The Row,
// the Group and the Tabs show as on the board, each field inside them shows its answered value
// read-only, the Tabs switch by keyboard, and nothing can be changed. The session process serves
// this test whatever the target.

import { describe, expect, test } from "bun:test";
import { SNAPSHOT_DATA_ELEMENT, type SnapshotData } from "@askboard/contract";
import { validateSnapshotData } from "@askboard/contract/validate";
import type { Browser } from "playwright";
import { selectChunks, targetOf } from "../../src/assemble/index.ts";
import { atomAsk } from "./fixtures/atom-documents.ts";
import type { Asker } from "./harness/asker.ts";
import { eventually, STEP_TIMEOUT_MS, TEST_TIMEOUT_MS, useEngine } from "./harness/board-test.ts";
import { launchEngine } from "./harness/browser.ts";
import { enginesFrom } from "./harness/engines.ts";
import { actsDone, answerOf, lifecycleScenario, openBoard } from "./harness/lifecycle-test.ts";
import { readViewBuild } from "./harness/view-build.ts";

const dist = await readViewBuild();
const ASKER: Asker = { project: "order-service", gitUser: "Sara Rossi" };

const field = (id: string, label: string) => ({ type: "text-field", id, props: { label } });
const days = { type: "number-field", id: "days", props: { label: "Days", min: 0, max: 20 } };
const panel = (id: string, title: string, ...items: unknown[]) => ({ id, title, items });
const ITEMS = [
  { type: "row", id: "pair", props: { items: [field("left", "Left"), field("right", "Right")] } },
  {
    type: "tabs",
    id: "sections",
    props: {
      tabs: [
        panel("people", "People", {
          type: "group",
          id: "contact",
          props: { title: "Contact", items: [field("phone", "Phone")] },
        }),
        panel("effort", "Effort", days),
      ],
    },
  },
];

/** The `askboard-data` block, cut out by the text rule. */
const dataBlockOf = (page: string): SnapshotData => {
  const opening = `id="${SNAPSHOT_DATA_ELEMENT}">`;
  const start = page.indexOf(opening) + opening.length;
  return JSON.parse(page.slice(start, page.indexOf("</script>", start))) as SnapshotData;
};

for (const engine of enginesFrom(process.env.ASKBOARD_E2E_ENGINES)) {
  describe(`${engine}: a Snapshot of an answered arranged question`, () => {
    const { start } = useEngine(engine);

    test(
      "the Row, the Group and the Tabs show with each answered value read-only, the Tabs switch by keyboard, nothing can be changed, and no CSP problem is reported",
      async () => {
        const run = await start({ ...lifecycleScenario(atomAsk(ITEMS), dist), asker: ASKER });
        const board = await openBoard(run, ["plan"]);
        const label = (name: string) => board.view.getByLabel(name, { exact: true });
        await label("Left").fill("L1");
        await label("Right").fill("R1");
        await label("Phone").fill("555-0100");
        await board.view.getByRole("tab", { name: "Effort" }).click();
        await label("Days").fill("7");
        await answerOf(board, "plan").click({ timeout: STEP_TIMEOUT_MS });
        await actsDone(run, 1);
        const taken = await run.session.snapshot();
        await run.session.exit();
        const html = await Bun.file(taken.path).text();
        const data = dataBlockOf(html);
        expect(validateSnapshotData(data).ok).toBe(true);
        const chunks = selectChunks(data.document, dist.manifest, targetOf(data));
        for (const name of ["row", "group", "tabs", "text-field", "number-field"]) {
          expect(chunks.map((chunk) => chunk.name)).toContain(name);
        }
        for (const { name, chunk } of chunks) {
          const text = dist.files.get(chunk.script.path);
          expect({ name, inlined: text !== undefined && html.includes(text) }).toEqual({
            name,
            inlined: true,
          });
        }

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
          page.on("console", (message) => {
            if (message.text().startsWith("CSP ")) violations.push(message.text());
          });
          await page.goto(`file://${taken.path}`);
          const at = (name: string) => page.getByLabel(name, { exact: true });
          await at("Left").waitFor({ timeout: STEP_TIMEOUT_MS });
          expect(await page.getByRole("group", { name: "Contact" }).count()).toBe(1);
          expect(await at("Left").inputValue()).toBe("L1");
          expect(await at("Right").inputValue()).toBe("R1");
          expect(await at("Phone").inputValue()).toBe("555-0100");
          // The Tabs switch by keyboard, answered or not; the other panel's value shows then.
          const people = page.getByRole("tab", { name: "People" });
          const effort = page.getByRole("tab", { name: "Effort" });
          await people.focus();
          await page.keyboard.press("ArrowRight");
          await eventually(
            async () => (await effort.getAttribute("aria-selected")) === "true",
            "the second tab selected",
          );
          await at("Days").waitFor({ state: "visible", timeout: STEP_TIMEOUT_MS });
          expect(await at("Days").inputValue()).toBe("7");
          await page.keyboard.press("Home");
          await eventually(
            async () => (await people.getAttribute("aria-selected")) === "true",
            "the first tab selected",
          );
          // Read-only: the fields refuse text.
          for (const name of ["Left", "Right", "Phone", "Days"]) {
            expect({ name, readonly: await at(name).getAttribute("readonly") }).not.toEqual({
              name,
              readonly: null,
            });
          }
          await at("Left")
            .press("x", { noWaitAfter: true })
            .catch(() => undefined);
          await new Promise((resolve) => setTimeout(resolve, 500));
          expect(await at("Left").inputValue()).toBe("L1");
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
