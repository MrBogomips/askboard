// Test-only board documents holding a Scale (approval-scale-ranking, task 5.2): the fixture
// Tree's question `plan` with the Scale `share` as its only item, as the agent sends it, and the
// same ask for the session process.

import type { Locale } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import { plan } from "./tree-documents.ts";

/** A slider from 0 to 100 by 5 with a percent unit. */
export const SLIDER_PROPS = { min: 0, max: 100, step: 5 } as const;

/** The question `plan` holding the Scale `share` with `props`, in `language` (en-US by default). */
export const scaleDocument = (props: object, language?: Locale): ViewDocument =>
  ({
    ...treeBoardDocument,
    ...(language === undefined ? {} : { language }),
    items: [
      {
        ...plan,
        props: { ...plan.props, items: [{ type: "scale", id: "share", props }] },
      },
    ],
  }) as unknown as ViewDocument;

/** The ask for the session process: the question `plan` with the Scale `share`. */
export const scaleAsk = (props: object) =>
  ({
    askId: "portal-sow-plan-t2v6",
    title: "Customer portal SOW plan",
    items: [
      {
        type: "question",
        id: "plan",
        props: { ...plan.props, items: [{ type: "scale", id: "share", props }] },
      },
    ],
  }) as const;
