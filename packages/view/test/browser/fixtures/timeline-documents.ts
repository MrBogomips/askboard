// Test-only board documents holding a Timeline (latex-kanban-timeline, task 5.3): the fixture
// Tree's question `plan` with the Timeline `roadmap` as its only item, as the agent sends it; a
// year-long one whose first date is a milestone, one on the last day a Gantt may name, one of a
// single lane and one with a long lane label; and the ask for the session process. The drafts'
// values are read from the host's mirror.

import type { Locale } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import type { WidgetHostRun } from "../harness/widget-host-test.ts";
import { plan } from "./tree-documents.ts";

export const TIMELINE_ID = "roadmap";

const LANES = {
  "en-US": [
    { id: "web", label: "Web" },
    { id: "mobile", label: "Mobile" },
  ],
  "it-IT": [
    { id: "web", label: "Web" },
    { id: "mobile", label: "Mobile" },
  ],
} as const;

/** The Timeline as the agent sends it: a range in `web` and a milestone in `mobile`, a month apart. */
export const timelineItem = (language: Locale = "en-US") => ({
  type: "timeline" as const,
  id: TIMELINE_ID,
  props: {
    lanes: LANES[language],
    entries: [
      {
        id: "checkout",
        label: language === "it-IT" ? "Checkout" : "Checkout",
        lane: "web",
        start: "2026-01-05",
        end: "2026-01-09",
      },
      {
        id: "launch",
        label: language === "it-IT" ? "Lancio" : "Launch",
        lane: "mobile",
        date: "2026-02-02",
      },
    ],
  },
});

/** The props once `checkout` is a week later and in `mobile`. */
export const MOVED_CHECKOUT = {
  ...timelineItem().props,
  entries: timelineItem().props.entries.map((entry) =>
    entry.id === "checkout"
      ? { ...entry, lane: "mobile", start: "2026-01-12", end: "2026-01-16" }
      : entry,
  ),
};

/** A year: a milestone on 2026-01-01 and a range to 2026-12-18, which only month zoom fits. */
export const yearItem = () => ({
  type: "timeline" as const,
  id: TIMELINE_ID,
  props: {
    lanes: [{ id: "web", label: "Web" }],
    entries: [
      { id: "kickoff", label: "Kickoff", lane: "web", date: "2026-01-01" },
      { id: "build", label: "Build", lane: "web", start: "2026-01-05", end: "2026-12-18" },
    ],
  },
});

/** One milestone on the last day a Gantt may name, alone in one lane. */
export const lastDayItem = () => ({
  type: "timeline" as const,
  id: TIMELINE_ID,
  props: {
    lanes: [{ id: "web", label: "Web" }],
    entries: [{ id: "end", label: "End of days", lane: "web", date: "9999-12-31" }],
  },
});

/** The sent Timeline with a lane label too long for the column. */
export const LONG_LANE = "Customer portal mobile applications";
export const longLaneItem = () => {
  const { props } = timelineItem();
  return {
    type: "timeline" as const,
    id: TIMELINE_ID,
    props: { ...props, lanes: [{ id: "web", label: LONG_LANE }, props.lanes[1]] },
  };
};

const documentOf = (items: readonly unknown[], language?: Locale): ViewDocument =>
  ({
    ...treeBoardDocument,
    ...(language === undefined ? {} : { language }),
    items: [{ ...plan, props: { ...plan.props, items } }],
  }) as unknown as ViewDocument;

/** The question `plan` holding one Timeline, in `language` (en-US by default). */
export const timelineDocument = (
  item: ReturnType<typeof timelineItem> | ReturnType<typeof yearItem> = timelineItem(),
  language?: Locale,
): ViewDocument => documentOf([item], language);

/** The question `plan` holding the Timeline given, whatever its shape. */
export const documentWith = (item: unknown, language?: Locale): ViewDocument =>
  documentOf([item], language);

/** The ask for the session process: the question `plan` with the Timeline. */
export const timelineAsk = {
  askId: "portal-sow-plan-t2v6",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: { ...plan.props, items: [timelineItem()] },
    },
  ],
} as const;

type Mirrored = {
  readonly record: {
    readonly questions: Readonly<
      Record<string, { readonly values?: Readonly<Record<string, unknown>> } | undefined>
    >;
  };
};

/** The value the latest draft mirror holds for the item `id`; undefined when it holds none. */
export const draftProps = (run: WidgetHostRun, id = TIMELINE_ID): unknown => {
  const last = run.drafts.at(-1) as unknown as Mirrored | undefined;
  return last?.record.questions[plan.id]?.values?.[id];
};
