// Test-only board documents holding an Approval (approval-scale-ranking, task 5.1): the fixture
// Tree's question `plan` with the Tree `wbs` and, last, the Approval `verdict`, as the agent
// sends them; and the same ask for the session process.

import type { Locale } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import { plan, wbs } from "./tree-documents.ts";

/** The Approval, last in the question it approves. */
export const VERDICT = { type: "approval", id: "verdict", props: {} } as const;

/** The question `plan` holding the Tree and the Approval, in `language` (en-US by default). */
export const approvalDocument = (language?: Locale): ViewDocument =>
  ({
    ...treeBoardDocument,
    ...(language === undefined ? {} : { language }),
    items: [{ ...plan, props: { ...plan.props, items: [wbs, VERDICT] } }],
  }) as unknown as ViewDocument;

/** The ask for the session process: the question `plan` with the Tree and the Approval. */
export const approvalAsk = {
  askId: "portal-sow-plan-t2v6",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: { ...plan.props, items: [wbs, VERDICT] },
    },
  ],
} as const;
