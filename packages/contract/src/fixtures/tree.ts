// The Tree's fixtures (tree-widget design decision 4): the approved example uj2-wbs-gantt's work
// breakdown as a plain Tree in a board document, the Tree the user left after the approved answer,
// and that answer's event. The molecule's nodes keep their IDs, names, numbers and nesting; their
// `excerpt` pointers (AD-12) are no Tree field, and the three estimates become number columns.
// Tests only, and only test documents: E1's board document refuses a question holding a Tree.

import {
  BOARD_DOCUMENT_VERSION,
  type BoardDocument,
  type BoardQuestion,
} from "../schemas/board-document/index.ts";
import type { QuestionProps } from "../schemas/input/index.ts";
import type { AnswerEvent } from "../schemas/output/index.ts";
import type { TreeColumn, TreeItem, TreeProps } from "../widgets/tree/index.ts";

/** A question that holds widget items beside its options or instead of them (AD-7, Questions). */
type WidgetQuestionProps = Omit<QuestionProps, "options" | "items"> & {
  readonly options?: QuestionProps["options"];
  readonly items: readonly [TreeItem];
};

/** E1's board document whose one question holds a Tree: a test document until the input format admits widgets. */
export type TreeBoardDocument = Omit<BoardDocument, "items"> & {
  readonly items: readonly [Omit<BoardQuestion, "props"> & { readonly props: WidgetQuestionProps }];
};

const COLUMNS: readonly TreeColumn[] = [
  { field: "optimistic", label: "Optimistic", type: "number" },
  { field: "mostLikely", label: "Most likely", type: "number" },
  { field: "pessimistic", label: "Pessimistic", type: "number" },
];

/** The UJ-2 plan at rev 1: the question `plan` holding the Tree `wbs`, with no options. */
export const treeBoardDocument: TreeBoardDocument = {
  version: BOARD_DOCUMENT_VERSION,
  askId: "portal-sow-plan-t2v6",
  title: "Customer portal SOW plan",
  items: [
    {
      type: "question",
      id: "plan",
      rev: 1,
      props: {
        text: "Does this plan fit the SOW? Split, move or re-estimate work packages as needed.",
        header: "Plan",
        items: [
          {
            type: "tree",
            id: "wbs",
            props: {
              columns: COLUMNS,
              nodes: [
                {
                  id: "design",
                  label: "Design",
                  children: [
                    { id: "ux", label: "UX design", optimistic: 3, mostLikely: 5, pessimistic: 10 },
                    {
                      id: "architecture",
                      label: "Architecture",
                      optimistic: 2,
                      mostLikely: 4,
                      pessimistic: 6,
                    },
                    {
                      id: "prototype",
                      label: "Clickable prototype",
                      optimistic: 3,
                      mostLikely: 4,
                      pessimistic: 8,
                    },
                  ],
                },
                {
                  id: "build",
                  label: "Build",
                  children: [
                    {
                      id: "portal",
                      label: "Customer portal",
                      optimistic: 8,
                      mostLikely: 12,
                      pessimistic: 20,
                    },
                    {
                      id: "billing",
                      label: "Billing integration",
                      optimistic: 5,
                      mostLikely: 8,
                      pessimistic: 15,
                    },
                    {
                      id: "reporting",
                      label: "Reporting",
                      optimistic: 3,
                      mostLikely: 5,
                      pessimistic: 9,
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    },
  ],
};

/** The Tree as the user left it in the approved answer: `portal` split, `u-1` added after it. */
export const treeEditedValue: TreeProps = {
  columns: COLUMNS,
  nodes: [
    {
      id: "design",
      label: "Design",
      children: [
        { id: "ux", label: "UX design", optimistic: 3, mostLikely: 4, pessimistic: 10 },
        { id: "architecture", label: "Architecture", optimistic: 2, mostLikely: 4, pessimistic: 6 },
        {
          id: "prototype",
          label: "Clickable prototype",
          optimistic: 3,
          mostLikely: 4,
          pessimistic: 8,
        },
      ],
    },
    {
      id: "build",
      label: "Build",
      children: [
        {
          id: "portal",
          label: "Customer portal: accounts",
          optimistic: 4,
          mostLikely: 6,
          pessimistic: 10,
        },
        {
          id: "u-1",
          label: "Customer portal: dashboards",
          optimistic: 4,
          mostLikely: 7,
          pessimistic: 12,
        },
        {
          id: "billing",
          label: "Billing integration",
          optimistic: 5,
          mostLikely: 8,
          pessimistic: 21,
        },
        { id: "reporting", label: "Reporting", optimistic: 3, mostLikely: 5, pessimistic: 9 },
      ],
    },
  ],
};

/**
 * The approved answer's event without the Gantt plan's operation and `derived`, which waits for
 * compute: its `changes` are the Tree's, in the diff's order.
 */
export const treeAnswer: AnswerEvent = {
  cursor: "k3x9.1",
  type: "answer",
  itemId: "plan",
  rev: 1,
  who: "Sara Conti",
  when: "2026-10-29T14:05:12Z",
  changes: [
    { op: "set", target: "wbs.ux.mostLikely", value: 4 },
    { op: "set", target: "wbs.portal.label", value: "Customer portal: accounts" },
    { op: "set", target: "wbs.portal.mostLikely", value: 6 },
    { op: "set", target: "wbs.portal.optimistic", value: 4 },
    { op: "set", target: "wbs.portal.pessimistic", value: 10 },
    {
      op: "add",
      target: "wbs.u-1",
      parent: "build",
      after: "portal",
      value: {
        label: "Customer portal: dashboards",
        optimistic: 4,
        mostLikely: 7,
        pessimistic: 12,
      },
    },
    { op: "set", target: "wbs.billing.pessimistic", value: 21 },
  ],
};
