// The Snapshot data (owner `snapshot`, AD-7; snapshot design decision 2): a Snapshot's
// `askboard-data` block, which the view boots from with no host and an agent reads without
// rendering. A Snapshot outlives the versions that wrote it, so the data names each one.
// Widget-registry's minor adds the results kept for an answer logged too large (design decision 6).
// Snapshot-toolbar's minor adds the record's optional presentation, the theme and density a board
// would open with (design decision 2).
// Reopen-start-from-answer's minor admits the board state's `unchanged` (design decision 7).

import type { OriginMessage } from "../../push/messages.ts";
import type { SchemaSet } from "../../versions.ts";
import type { LifecycleBoardDocument } from "../board-document/index.ts";
import type { LifecycleBoardState } from "../board-protocol/index.ts";
import type { ConfigurationValues } from "../configuration/index.ts";
import type { QuestionProps } from "../input/index.ts";
import type { DiscardedEvent, OutputEvent } from "../output/index.ts";
import snapshotData from "./snapshot-data.json" with { type: "json" };

export const SNAPSHOT_DATA_VERSION = "1.3";

export const SNAPSHOT_DATA_ID = "urn:askboard:snapshot-data:snapshot-data";

export const snapshotDataSet: SchemaSet = {
  name: "snapshot-data",
  title: "Snapshot data",
  owner: "snapshot",
  version: SNAPSHOT_DATA_VERSION,
  schemas: [snapshotData],
};

/** Since snapshot-toolbar: the theme and density a board would open with (AD-14). */
export type SnapshotPresentation = Pick<ConfigurationValues, "theme" | "density">;

/**
 * When the Snapshot was taken, and by whom (FR-19 for the user's); since snapshot-toolbar also the
 * presentation, when it could be read.
 */
export type SnapshotRecord =
  | {
      readonly takenAt: string;
      readonly takenBy: "agent";
      readonly presentation?: SnapshotPresentation;
    }
  | {
      readonly takenAt: string;
      readonly takenBy: "user";
      readonly who: string;
      /** The board held unsent work, as its request said; never read from the draft record. */
      readonly unsentWork?: true;
      readonly presentation?: SnapshotPresentation;
    };

/** An earlier revision of a question that an event names. */
export type SnapshotRevision = {
  readonly itemId: string;
  readonly rev: number;
  readonly props: QuestionProps;
};

/**
 * One logged event, with the full values kept for its answer, by item ID in reference addressing.
 * An ask that is not discarded logs every output event but `discarded`.
 */
export type SnapshotEvent = {
  readonly event: Exclude<OutputEvent, DiscardedEvent>;
  readonly values?: Readonly<Record<string, unknown>>;
  /** Since widget-registry: the results kept for an event logged too large, which has none. */
  readonly results?: Readonly<Record<string, unknown>>;
};

/** One entry of the molecule expansion map. */
export type SnapshotExpansion = {
  readonly itemId: string;
  readonly reference: string;
  readonly molecule: string;
  readonly version: string;
};

/** A kept diagram render of one item's revision, as SVG text per theme. */
export type SnapshotRender = {
  readonly itemId: string;
  readonly rev: number;
  readonly light: string;
  readonly dark: string;
};

export type SnapshotData = {
  readonly versions: {
    readonly snapshot: string;
    readonly output: string;
    readonly boardProtocol: string;
  };
  readonly snapshot: SnapshotRecord;
  readonly epoch: string;
  readonly askId: string;
  /** The current board document: `BootData`'s name, so the view boots a Snapshot like a board. */
  readonly document: LifecycleBoardDocument;
  readonly revisions: readonly SnapshotRevision[];
  /** The board state as the board receives it: `BootData`'s name too. */
  readonly state: LifecycleBoardState;
  /** Who asked and where, as `board-host` sends the board: `BootData`'s name too. */
  readonly origin?: OriginMessage;
  /** The whole log, in `seq` order. */
  readonly events: readonly SnapshotEvent[];
  readonly molecules?: readonly SnapshotExpansion[];
  readonly renders?: readonly SnapshotRender[];
};
