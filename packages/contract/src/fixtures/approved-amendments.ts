// The amendments to the approved texts (agent-facing-gaps, design decision 4). The approved texts
// are the `review-model-contract` examples, archived and copied among the contract's fixtures
// byte for byte; a later change that the PO approves to reword a tool description or the server
// instructions records the amendment here instead of editing the copies. The texts the contract
// serves equal the approved texts with these amendments applied, in order, which the contract's
// tests check. Later amendments are appended.

/** One approved rewording: where it applies, what it replaces and what replaces it. */
export type ApprovedTextAmendment = {
  /** The OpenSpec change that made the amendment. */
  readonly change: string;
  /** The date of the PO's approval of the new text. */
  readonly approved: string;
  /** `server-instructions.md`, or `tools.json#<tool>.description`. */
  readonly target: string;
  /** The text replaced; it must occur exactly once in the target's text at its turn. */
  readonly from: string;
  readonly to: string;
};

export const APPROVED_TEXT_AMENDMENTS: readonly ApprovedTextAmendment[] = [
  {
    change: "agent-facing-gaps",
    approved: "2026-11-08",
    target: "tools.json#update.description",
    from: "Change an open ask by item ID: add, change, delete or reopen an item; record an answer the user gave you outside the board; reply to a follow-up, naming its cursor; or close the ask. A question that already has an answer can only be reopened, which starts a new revision.",
    to: "Change an open ask by item ID: add a question or an area; change an item's props, each key you send replacing its value whole (to add a widget to a question, change the question's `items`, sent whole); delete or reopen an item; record an answer the user gave you outside the board; reply to a follow-up, naming its question in `itemId` and its cursor in `followUp`; or close the ask. A question that already has an answer can only be reopened, which starts a new revision.",
  },
  {
    change: "agent-facing-gaps",
    approved: "2026-11-08",
    target: "server-instructions.md",
    from: "- Reply to follow-ups at once with `update` (`reply`): the user is waiting for you.",
    to: "- Reply to follow-ups at once with `update` (`reply`, with the question's `itemId` and the follow-up's cursor): the user is waiting for you.",
  },
  {
    change: "skill-engagement",
    approved: "2026-11-10",
    target: "server-instructions.md",
    from: "Use it for questions AskUserQuestion carries badly: more than four at once, or a question that needs a diff, a plan, a tree, a table, a graph, a diagram, an image, or a file excerpt beside it. For one quick choice AskUserQuestion is fine, unless the user's asking rule says otherwise.",
    to: "Use it when a question is hard to grasp or to answer in a terminal dialog, whatever the number of questions or options: questions that are many and depend on one another; questions that cite documents by bare IDs (D-01, FR-12, ADR-7) the user would have to look up; content that reads better seen and worked on, such as a plan, a WBS or a Gantt, a chart, a table, a diagram or a state machine, a formula, or a document to review. These are examples: judge whether a visual, interactive board helps the user decide. A simple, self-explanatory choice stays in AskUserQuestion. The user's asking rule, or the user's own instruction about how to ask, decides first.",
  },
  {
    change: "skill-engagement",
    approved: "2026-11-10",
    target: "server-instructions.md",
    from: "- Put everything you need in one `ask`, then keep working.",
    to: "- Load the askboard skill (as a plugin skill, `askboard:askboard`) before your first `ask`: it says how to build each item.\n- Never put a complex question to the user in chat prose: ask it on the board.\n- Put everything you need in one `ask`, then keep working.",
  },
  {
    change: "skill-engagement",
    approved: "2026-11-10",
    target: "tools.json#ask.description",
    from: "The askboard skill lists every item type and its props.",
    to: "Load the askboard skill before your first ask: it says when to ask here rather than with AskUserQuestion, and lists every item type and its props.",
  },
];

/**
 * The approved text of `target` with its amendments applied, in order. An amendment whose `from`
 * is not found exactly once throws, naming its change and target.
 */
export const amendedApprovedText = (
  target: string,
  text: string,
  amendments: readonly ApprovedTextAmendment[] = APPROVED_TEXT_AMENDMENTS,
): string =>
  amendments
    .filter((amendment) => amendment.target === target)
    .reduce((current, { change, from, to }) => {
      const found = current.split(from).length - 1;
      if (found !== 1) {
        throw new Error(
          `the amendment of ${change} to ${target} replaces a text found ${found} times, not once`,
        );
      }
      return current.replace(from, () => to);
    }, text);
