// Test-only board documents holding a Ranking (approval-scale-ranking, task 5.3): the fixture
// Tree's question `plan` with the contract's Ranking `priorities` as its only item, or after the
// Tree `wbs`, as the agent sends them; and the ask for the session process.

import type { Locale } from "@askboard/contract";
import { RANKING_FIXTURE_ITEM, treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import { plan, wbs } from "./tree-documents.ts";

/** The Ranking's rows as the agent sent them, in order. */
export const SENT_ORDER = RANKING_FIXTURE_ITEM.props.items.map(({ id }) => id);

const documentOf = (items: readonly unknown[], language?: Locale): ViewDocument =>
  ({
    ...treeBoardDocument,
    ...(language === undefined ? {} : { language }),
    items: [{ ...plan, props: { ...plan.props, items } }],
  }) as unknown as ViewDocument;

/** The question `plan` holding the Ranking alone, in `language` (en-US by default). */
export const rankingDocument = (language?: Locale): ViewDocument =>
  documentOf([RANKING_FIXTURE_ITEM], language);

/** The question `plan` holding the Tree `wbs`, then the Ranking. */
export const treeAndRankingDocument: ViewDocument = documentOf([wbs, RANKING_FIXTURE_ITEM]);

/** The ask for the session process: the question `plan` with the Ranking. */
export const rankingAsk = {
  askId: "portal-sow-plan-t2v6",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: { ...plan.props, items: [RANKING_FIXTURE_ITEM] },
    },
  ],
} as const;
