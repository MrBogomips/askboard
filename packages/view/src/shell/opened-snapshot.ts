// An opened Snapshot's chrome (view spec, The Snapshot view's chrome; EXPERIENCE.md, Snapshots:
// Snapshot view): what the boot block's `snapshot` record says, the top line from it, and the tab
// title. A Snapshot has no parent, so the shell reads the record once and keeps it in the board's
// context as a flag, not a port field (snapshot design decision 9).

import type { SnapshotRecord } from "@askboard/contract";
import { UNSENT_WORK_NOTE } from "../snapshot-line.ts";
import { isPresentation, type ViewPresentation } from "../view-protocol.ts";
import { DEFAULT_PRESENTATION } from "./presentation-controls.ts";

/** The record the boot block holds when the page is a Snapshot. */
export type OpenedSnapshot = SnapshotRecord;

/** The time as en-US month, day, year, hours and minutes, in the viewer's zone unless one is given. */
export const takenAtOf = (takenAt: string, timeZone?: string): string => {
  const zone = timeZone === undefined ? {} : { timeZone };
  const when = new Date(takenAt);
  const day = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...zone,
  }).format(when);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", ...zone })
    .format(when)
    // Newer ICU data puts a narrow no-break space before AM and PM.
    .replace(/\s/g, " ");
  return `${day}, ${time}`;
};

/** Who took the Snapshot, as the top line says it. */
export const takenByOf = (opened: OpenedSnapshot): string =>
  opened.takenBy === "agent" ? "the agent" : opened.who;

/** The top line's words after "Snapshot", and the unsent-work note when the data records it. */
export type TopLine = { readonly taken: string; readonly note?: string };

export const topLineOf = (opened: OpenedSnapshot, timeZone?: string): TopLine => {
  const taken = ` · taken ${takenAtOf(opened.takenAt, timeZone)} by ${takenByOf(opened)} · read-only`;
  return opened.takenBy === "user" && opened.unsentWork === true
    ? { taken, note: UNSENT_WORK_NOTE }
    : { taken };
};

/** The tab's title; the ask's title is agent text and goes in through the DOM only. */
export const snapshotTitleOf = (askTitle: string): string => `Snapshot · ${askTitle}`;

/**
 * The presentation an opened Snapshot starts in (snapshot-toolbar, design decision 4): the theme
 * and density its record names, the placement beside and nothing locked; the defaults when the
 * record names none or a hand-edited file names a value the page does not know, so that only the
 * two enums ever reach the page's classes.
 */
export const snapshotPresentationOf = (opened: OpenedSnapshot): ViewPresentation => {
  const recorded: unknown = opened.presentation;
  if (typeof recorded !== "object" || recorded === null) return DEFAULT_PRESENTATION;
  const { theme, density } = recorded as { theme?: unknown; density?: unknown };
  const candidate = { theme, density, contextPlacement: "beside", locked: [] };
  return isPresentation(candidate) ? candidate : DEFAULT_PRESENTATION;
};
