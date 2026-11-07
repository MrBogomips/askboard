// Test-only asks of the Approval's end-to-end tests (approval-scale-ranking, task 6.1), sent to the
// session process as they are: the question `plan` holding the Tree `wbs` and the Approval
// `verdict`, and a second question `review` holding options with a recommended one and the
// Approval `second`, in immediate or in submitted delivery.

import { database } from "./lifecycle-asks.ts";
import { plan, wbs } from "./tree-documents.ts";

/** The Approval of the plan question, last in it. */
export const VERDICT = { type: "approval", id: "verdict", props: {} } as const;

/** The Approval of the review question. */
export const SECOND = { type: "approval", id: "second", props: {} } as const;

const planQuestion = {
  type: "question",
  id: "plan",
  props: { ...plan.props, items: [wbs, VERDICT] },
} as const;

/** The question `review`: the database options, PostgreSQL recommended, and an Approval. */
export const reviewQuestion = (text?: string) => {
  const { header, ...props } = database("review").props;
  return {
    type: "question",
    id: "review",
    props: {
      ...props,
      // A question with a long text of its own is listed by it, not by a header chip.
      ...(text === undefined ? { header } : { text }),
      allowOther: false,
      items: [SECOND],
    },
  } as const;
};

/** The plan and the review in `delivery`, the review's text `reviewText` when given. */
export const reviewedAsk = (delivery: "immediate" | "submitted", reviewText?: string) =>
  ({
    askId: `reviewed-${delivery}-a1b2`,
    title: "Customer portal SOW plan",
    delivery,
    items: [planQuestion, reviewQuestion(reviewText)],
  }) as const;
