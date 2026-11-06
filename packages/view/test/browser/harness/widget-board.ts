// Where the widget answer scenarios run (widget-answers, task 5.5; design decision 9, Browser): on
// the widget host always, and under `--target session-process` on the real board page as well, the
// ask being the one that gives the scenario's board document. A scenario takes the host the same
// way in both places: the session-process host answers `board` and `messages` as the widget host
// does, its messages being the question's `ready` and the answers the board page sent to the
// session, read from the act commands.

import { join } from "node:path";
import { uj2ExpandedBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import type { ViewMessage } from "../../../src/view-protocol.ts";
import { useEngine } from "./board-test.ts";
import type { Engine } from "./engines.ts";
import { barButton, buttonOf, lifecycleScenario, openBoard, sentActs } from "./lifecycle-test.ts";
import { type AskInput, askInputFor } from "./scenario-ask.ts";
import { targetFrom } from "./target.ts";
import type { ViewBuild } from "./view-build.ts";
import { useWidgetHost, type WidgetHostRun } from "./widget-host-test.ts";

/** The places a widget answer scenario runs in. */
export type Place = "widget host" | "session process";

/** The widget host, and the session process too when the run targets it. */
export const placesOf = (): readonly Place[] =>
  targetFrom(process.env.ASKBOARD_E2E_TARGET) === "session-process"
    ? ["widget host", "session process"]
    : ["widget host"];

/** What a describe's name says of where it runs; nothing for the widget host. */
export const placeSuffix = (place: Place): string =>
  place === "widget host" ? "" : ` on the ${place}`;

const UJ2_ASK = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "..",
  "contract",
  "test",
  "fixtures",
  "asks",
  "uj2-wbs-gantt.json",
);

// The ask for a board document: the approved UJ-2 ask for the expanded UJ-2 document, whose
// molecule references the session process expands; otherwise the document's own items.
const askOf = async (document: ViewDocument): Promise<AskInput> => {
  if ((document as unknown) === uj2ExpandedBoardDocument) return Bun.file(UJ2_ASK).json();
  return askInputFor({
    name: document.askId,
    askId: document.askId,
    token: "",
    steps: [{ from: "host", message: { type: "board", document } }],
  } as never);
};

/** A widget host run that may need a Submit: the session process holds a several-question board's acts. */
export type BoardRun = WidgetHostRun & {
  /** Postpones the questions the scenario leaves alone and submits; nothing on the widget host. */
  submit?(): Promise<void>;
  /** The answer events the session logged, as `collect` returns them; absent on the widget host. */
  logged?(): Promise<readonly LoggedAnswer[]>;
};

/** The parts of a logged answer event the scenarios compare. */
export type LoggedAnswer = {
  readonly changes?: readonly unknown[];
  readonly derived?: Readonly<Record<string, unknown>>;
};

/** Opens the board in the session process and gives it the shape of a widget host run. */
const sessionHost =
  (start: ReturnType<typeof useEngine>["start"]) =>
  async (build: ViewBuild, document: ViewDocument): Promise<BoardRun> => {
    const [{ id: questionId }, ...others] = document.items;
    const run = await start(lifecycleScenario(await askOf(document), build));
    const board = await openBoard(run, [questionId, ...others.map(({ id }) => id)]);
    return {
      logged: async () => {
        const { events } = await run.session.collect();
        return events.filter((event) => event.type === "answer") as readonly LoggedAnswer[];
      },
      submit: async () => {
        for (const { id } of others) await buttonOf(board, id, "Postpone").click();
        await barButton(board, "Submit").click();
      },
      board,
      browser: run.browser,
      get messages(): readonly ViewMessage[] {
        const answers = sentActs(run)
          .flatMap((command) => command.acts)
          .filter((act) => act.type === "answer");
        return [{ type: "ready", itemId: questionId }, ...(answers as unknown as ViewMessage[])];
      },
      drafts: [],
      activity: [],
      requests: [],
      update: () => Promise.reject(new Error("the session process host takes no view update")),
    };
  };

/** The host of a scenario in one place; call it inside the `describe`, once. */
export const widgetBoardFor = (
  engine: Engine,
  place: Place,
): { host(build: ViewBuild, document: ViewDocument): Promise<BoardRun> } => {
  // biome-ignore lint/correctness/useHookAtTopLevel: these are bun:test hook helpers, not React hooks; the place is fixed per describe
  if (place === "widget host") return useWidgetHost(engine);
  // biome-ignore lint/correctness/useHookAtTopLevel: as above
  const { start } = useEngine(engine);
  return { host: sessionHost(start) };
};
