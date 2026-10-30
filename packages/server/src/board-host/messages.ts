// The messages `board-host` sends over the board protocol (contract, board protocol set): built from
// what ask-core shows of an ask, and refusals whose detail fits the contract's limit.

import {
  BOARD_PROTOCOL_VERSION,
  type BoardState,
  type HostMessage,
  type QuestionStatus,
  REFUSAL_DETAIL_MAX_CHARS,
  type RefusalReason,
} from "@askboard/contract";
import type { Problem } from "@askboard/contract/validate";
import type { BoardView, QuestionView } from "@askboard/core";

const version = BOARD_PROTOCOL_VERSION;

const statusOf = ({ itemId, rev, answer }: QuestionView): QuestionStatus =>
  answer === undefined
    ? { itemId, rev, state: "open" }
    : {
        itemId,
        rev,
        state: "answered",
        answer: {
          choice: [...answer.choice],
          when: answer.when,
          receipt: answer.delivered ? "delivered" : "sent",
        },
      };

/**
 * The board state of an ask that is not discarded: the protocol's ask states are `waiting` and
 * `answered`, and a discarded ask's board is told with `discarded` instead (AD-21).
 */
export const stateOf = (board: BoardView): BoardState => ({
  ask: board.state === "answered" ? "answered" : "waiting",
  // E1's board document holds exactly one question (contract, board document set).
  questions: board.questions.map(statusOf) as unknown as BoardState["questions"],
});

export const boardMessage = (board: BoardView): HostMessage => ({
  version,
  type: "board",
  document: board.document,
});

export const stateMessage = (board: BoardView): HostMessage => ({
  version,
  type: "state",
  state: stateOf(board),
});

export const receiptMessage = (itemId: string): HostMessage => ({
  version,
  type: "receipt",
  itemId,
  receipt: "delivered",
});

export const MOVED: HostMessage = { version, type: "moved" };

export const DISCARDED: HostMessage = { version, type: "discarded", reason: "session-exit" };

/** Text cut to the contract's limit on a refusal's detail, in code points as the schema counts. */
export const cutDetail = (text: string): string => {
  const points = Array.from(text);
  if (points.length === 0) return "refused";
  if (points.length <= REFUSAL_DETAIL_MAX_CHARS) return text;
  return `${points.slice(0, REFUSAL_DETAIL_MAX_CHARS - 1).join("")}…`;
};

const PROBLEMS_SHOWN = 5;

/** The detail of a schema refusal: the first problems, each at its path unless it names its type. */
export const problemsDetail = (problems: readonly Problem[]): string =>
  problems
    .slice(0, PROBLEMS_SHOWN)
    .map(({ path, message }) =>
      path === "/" || path === "/type" ? message : `${path}: ${message}`,
    )
    .join("; ");

export const refusedMessage = (
  reason: RefusalReason,
  detail: string,
  itemId?: string,
): HostMessage => ({
  version,
  type: "refused",
  reason,
  detail: cutDetail(detail),
  ...(reason === "answer" && itemId !== undefined ? { itemId } : {}),
});
