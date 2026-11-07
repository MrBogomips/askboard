// Test-only board documents holding LaTeX items (latex-kanban-timeline, task 5.1): the fixture
// Tree's question `plan` with one LaTeX `formula`, or with a list of them, as the agent sends them;
// and the ask for the session process. The drafts' values are read from the host's mirror.

import type { Locale } from "@askboard/contract";
import { LATEX_FIXTURE_ITEM, treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import type { WidgetHostRun } from "../harness/widget-host-test.ts";
import { VERDICT } from "./approval-documents.ts";
import { plan } from "./tree-documents.ts";

/** The LaTeX item `formula` with `expression`, as the agent sends it. */
export const latexItem = (expression: string, id = LATEX_FIXTURE_ITEM.id) => ({
  type: "latex" as const,
  id,
  props: { expression },
});

/** The expression the fixture LaTeX is sent with. */
export const SENT_EXPRESSION = LATEX_FIXTURE_ITEM.props.expression;

const documentOf = (items: readonly unknown[], language?: Locale): ViewDocument =>
  ({
    ...treeBoardDocument,
    ...(language === undefined ? {} : { language }),
    items: [{ ...plan, props: { ...plan.props, items } }],
  }) as unknown as ViewDocument;

/** The question `plan` holding one LaTeX `formula`, in `language` (en-US by default). */
export const latexDocument = (expression: string = SENT_EXPRESSION, language?: Locale) =>
  documentOf([latexItem(expression)], language);

/** The question `plan` holding the LaTeX `formula` and, last, the Approval `verdict`. */
export const latexApprovalDocument = (language?: Locale): ViewDocument =>
  documentOf([LATEX_FIXTURE_ITEM, VERDICT], language);

/** The question `plan` holding the LaTeX items given, in order. */
export const latexItemsDocument = (items: readonly ReturnType<typeof latexItem>[]) =>
  documentOf(items);

/** The ask for the session process: the question `plan` with one LaTeX. */
export const latexAsk = {
  askId: "portal-sow-plan-t2v6",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      props: { ...plan.props, items: [LATEX_FIXTURE_ITEM] },
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

/** The value the latest draft mirror holds for the LaTeX `id`; undefined when it holds none. */
export const draftExpression = (run: WidgetHostRun, id = LATEX_FIXTURE_ITEM.id): unknown => {
  const last = run.drafts.at(-1) as unknown as Mirrored | undefined;
  return last?.record.questions[plan.id]?.values?.[id];
};
