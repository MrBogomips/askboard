// A Snapshot's data, gathered from what ask-core shows of one ask at one moment (snapshot design
// decision 3; AD-15): pure, over what the `snapshot` command reads from the aggregate in one step.
// It holds the current board document, the earlier revisions the log names, the board state as the
// board receives it, the origin row `board-host` sends, and the whole log; it reads no draft record,
// no board link, no agent record and no agent status (AD-20), since none is among its sources.
// Widget answers add each answer event's full edited values (`events[].values`) and the expansion
// map's entries (`molecules`), both left out when empty (widget-answers, design decision 7).

import {
  BOARD_PROTOCOL_VERSION,
  type DiscardedEvent,
  OUTPUT_FORMAT_VERSION,
  type OutputEvent,
  originMessage,
  SNAPSHOT_DATA_VERSION,
  type SnapshotData,
  type SnapshotRecord,
  type SnapshotRevision,
} from "@askboard/contract";
import type { KeptRevisions } from "../lifecycle/views.ts";
import type { ExpansionRecord } from "../molecules/map.ts";
import type { WhoAsked } from "../push/ports.ts";
import { boardStateOf, type OpenBoardView } from "./state.ts";

/** Who takes the Snapshot: the agent, or the user, named by FR-19's rule. */
export type SnapshotTaker =
  | { readonly takenBy: "agent" }
  | {
      readonly takenBy: "user";
      readonly who: string;
      /** The board said it held unsent work; never read from the draft record (AD-20). */
      readonly unsentWork: boolean;
    };

/** What the gathering reads, all from the same moment. */
export type SnapshotSources = {
  readonly epoch: string;
  /** `AskCore.lifecycleBoard(askId)`. */
  readonly board: OpenBoardView;
  /** `AskCore.keptRevisions(askId)`. */
  readonly kept: readonly KeptRevisions[];
  /** The whole log, from `seq` 1, each event with its cursor. */
  readonly log: readonly OutputEvent[];
  /** RFC 3339 UTC, from the core's clock. */
  readonly takenAt: string;
  readonly taker: SnapshotTaker;
  /**
   * The project folder `board-host` names the origin row with (`PushComposition.projectDir`);
   * without it, as without `asked`, `board-host` sends no origin and the data holds none.
   */
  readonly projectDir?: string;
  /** `AskCore.whoAsked(askId)`. */
  readonly asked?: WhoAsked;
  /** `AskCore.keptAnswerValues(askId)`: the full edited values by event cursor, by item ID. */
  readonly keptAnswerValues?: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  /** `AskCore.keptAnswerResults(askId)`: the kept results by event cursor, by item ID. */
  readonly keptAnswerResults?: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  /** `expansionEntries(map)` of the ask's expansion map. */
  readonly molecules?: readonly ExpansionRecord[];
};

type LoggedEvent = Exclude<OutputEvent, DiscardedEvent>;

// An ask that is not discarded logs no `discarded` event: this keeps the type honest.
const isLogged = (event: OutputEvent): event is LoggedEvent => event.type !== "discarded";

const recordOf = (takenAt: string, taker: SnapshotTaker): SnapshotRecord =>
  taker.takenBy === "agent"
    ? { takenAt, takenBy: "agent" }
    : {
        takenAt,
        takenBy: "user",
        who: taker.who,
        ...(taker.unsentWork ? { unsentWork: true as const } : {}),
      };

// The revisions each question's events name: the one they were made on, and the one an `ignore`
// edit choice kept.
const namedRevisions = (log: readonly LoggedEvent[]): Map<string, Set<number>> => {
  const named = new Map<string, Set<number>>();
  const name = (itemId: string, rev: number) =>
    named.set(itemId, (named.get(itemId) ?? new Set()).add(rev));
  for (const event of log) {
    if (!("rev" in event)) continue;
    name(event.itemId, event.rev);
    if (event.type === "edit-choice" && event.edit === "ignore") name(event.itemId, event.keptRev);
  }
  return named;
};

// The kept revisions an event names, but each question's current one, which the document holds.
const revisionsOf = (
  board: OpenBoardView,
  kept: readonly KeptRevisions[],
  log: readonly LoggedEvent[],
): SnapshotRevision[] => {
  const current = new Map(board.questions.map(({ itemId, rev }) => [itemId, rev]));
  const named = namedRevisions(log);
  return kept.flatMap(({ itemId, revisions }) =>
    revisions
      .filter(({ rev }) => rev !== current.get(itemId) && named.get(itemId)?.has(rev) === true)
      .map(({ rev, props }) => ({ itemId, rev, props })),
  );
};

// An event with the full values kept for it, when there are any, and, for an answer logged
// `tooLarge`, which carries no results of its own, the results kept for it (widget-registry). An
// event logged whole holds none beside it: its own results are the record.
const loggedWith = (event: LoggedEvent, sources: SnapshotSources) => {
  const values = sources.keptAnswerValues?.get(event.cursor);
  const results =
    event.type === "answer" && event.tooLarge === true
      ? sources.keptAnswerResults?.get(event.cursor)
      : undefined;
  return {
    event,
    ...(values === undefined || Object.keys(values).length === 0 ? {} : { values }),
    ...(results === undefined || Object.keys(results).length === 0 ? {} : { results }),
  };
};

/** The Snapshot's data, as the ask stands in `sources`. */
export const gatherSnapshot = (sources: SnapshotSources): SnapshotData => {
  const { epoch, board, kept, takenAt, taker, projectDir, asked, molecules } = sources;
  const log = sources.log.filter(isLogged);
  const origin =
    projectDir === undefined || asked === undefined
      ? {}
      : { origin: originMessage(projectDir, asked) };
  return {
    versions: {
      snapshot: SNAPSHOT_DATA_VERSION,
      output: OUTPUT_FORMAT_VERSION,
      boardProtocol: BOARD_PROTOCOL_VERSION,
    },
    snapshot: recordOf(takenAt, taker),
    epoch,
    askId: board.askId,
    document: board.document,
    revisions: revisionsOf(board, kept, log),
    state: boardStateOf(board),
    ...origin,
    events: log.map((event) => loggedWith(event, sources)),
    ...(molecules === undefined || molecules.length === 0 ? {} : { molecules }),
  };
};
