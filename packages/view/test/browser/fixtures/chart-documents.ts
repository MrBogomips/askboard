// Test-only board documents holding a Chart (chart-widget, task 5.1): the fixture Tree's question
// `plan` with a Chart as its only item, as the agent sends it, and the same ask for the session
// process.

import type { Locale } from "@askboard/contract";
import { CHART_FIXTURE_ITEMS, treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import { plan } from "./tree-documents.ts";

const [BAR_ITEM, LINE_ITEM, PIE_ITEM] = CHART_FIXTURE_ITEMS;

/** The Chart item's ID in every document below. */
export const CHART_ID = "failures";

/** Three categories, two series, a gap; no axis names, so the plot is the box less the legend. */
export const BAR_PROPS = {
  ...BAR_ITEM.props,
  title: "Failures by fix",
} as const;

/** A line chart whose first series has a gap at its second category. */
export const LINE_PROPS = LINE_ITEM.props;

/** A pie that takes one slice. */
export const PIE_PROPS = PIE_ITEM.props;

/** The question `plan` holding the Chart `failures` with `props`, in `language` (en-US by default). */
export const chartDocument = (props: object, language?: Locale): ViewDocument =>
  ({
    ...treeBoardDocument,
    ...(language === undefined ? {} : { language }),
    items: [
      {
        ...plan,
        props: { ...plan.props, items: [{ type: "chart", id: CHART_ID, props }] },
      },
    ],
  }) as unknown as ViewDocument;

/** The ask for the session process: the question `plan` with the Chart `failures`. */
export const chartAsk = (props: object) =>
  ({
    askId: "portal-sow-plan-t2v6",
    title: "Customer portal SOW plan",
    items: [
      {
        type: "question",
        id: "plan",
        props: { ...plan.props, items: [{ type: "chart", id: CHART_ID, props }] },
      },
    ],
  }) as const;
