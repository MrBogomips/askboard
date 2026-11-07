// Test-only board documents and asks holding atoms (atoms, group 5): the fixture Tree's question
// `plan` with the atoms as its items, as the agent sends them, for the widget host, and the same
// question as an ask for the session process.

import type { Locale } from "@askboard/contract";
import { treeBoardDocument } from "@askboard/contract/fixtures";
import type { ViewDocument } from "../../../src/view-document.ts";
import { plan } from "./tree-documents.ts";

type Item = { readonly type: string; readonly id: string; readonly props: unknown };

/** The question `plan` holding `items`, in `language` (en-US by default). */
export const atomDocument = (items: readonly Item[], language?: Locale): ViewDocument =>
  ({
    ...treeBoardDocument,
    ...(language === undefined ? {} : { language }),
    items: [{ ...plan, props: { ...plan.props, items } }],
  }) as unknown as ViewDocument;

/** The ask for the session process: the question `plan` holding `items`. */
export const atomAsk = (items: readonly Item[], more: Readonly<Record<string, unknown>> = {}) =>
  ({
    askId: "atoms-plan-t2v6",
    title: "Atoms",
    items: [{ type: "question", id: "plan", props: { ...plan.props, items } }],
    ...more,
  }) as const;

/** The Markdown the Text scenarios share: a heading, emphasis, a link, a code block, a bad scheme. */
export const MARKDOWN_SOURCE =
  "# Heading\n\nSome **bold** text and [docs](https://example.com/docs).\n\n```\nconst x = 1;\n```\n\n[bad](javascript:alert(1))";

/** A question with two options, the first with a Markdown preview, the second with a plain one. */
export const previewAsk = {
  askId: "markdown-preview-a1b2",
  title: "Preview",
  items: [
    {
      type: "question",
      id: "database",
      props: {
        text: "Which database?",
        options: [
          {
            label: "PostgreSQL",
            preview: "```\nSELECT 1;\n```\n\nSee [the docs](https://example.com/docs).",
            previewFormat: "markdown",
          },
          { label: "SQLite", preview: "**plain** preview" },
        ],
      },
    },
  ],
} as const;
