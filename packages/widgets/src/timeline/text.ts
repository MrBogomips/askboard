// The Timeline's counter, names and cut labels (view-and-widgets spec: Timeline layout, Timeline at
// the keyboard; ux-update-draft block 2). Pure: the string lookup is passed in, and dates come from
// the contract's own formats in the ask's locale, with no `Intl`.

import { formatAxisLabel, type Locale, type TimelineEntry } from "@askboard/contract";
import type { Say } from "@askboard/view/catalog";

/** The toolbar's counter: "No changes", or "Your changes: N moved". */
export const counterText = (moved: number, text: Say): string =>
  moved === 0 ? text("widget.noChanges") : text("timeline.counterMoved", { count: moved });

// A day as the name gives it, without its year: `Jan 5`, `5 gen`.
const dayOf = (date: string, locale: Locale): string => formatAxisLabel(date, "week", locale);
// A full-date is YYYY-MM-DD, so the year is the first four digits.
const yearOf = (date: string): string => String(Number(date.slice(0, 4)));

/**
 * An entry's accessible name: its label whole, then a milestone's day or a range's days, in the
 * locale, and its lane's label, "Checkout, Jan 5 to Jan 9, 2026, Web". A range across two years
 * names both. An entry with no day, which the contract refuses, reads its label and lane.
 */
export const entryName = (
  entry: TimelineEntry,
  laneLabel: string,
  locale: Locale,
  text: Say,
): string => {
  const { label } = entry;
  const lane = laneLabel;
  if (typeof entry.start === "string" && typeof entry.end === "string") {
    const [start, end] = [dayOf(entry.start, locale), dayOf(entry.end, locale)];
    const [startYear, endYear] = [yearOf(entry.start), yearOf(entry.end)];
    return startYear === endYear
      ? text("timeline.entryRange", { label, start, end, year: endYear, lane })
      : text("timeline.entryRangeYears", { label, start, startYear, end, endYear, lane });
  }
  if (typeof entry.date === "string") {
    const [date, year] = [dayOf(entry.date, locale), yearOf(entry.date)];
    return text("timeline.entryMilestone", { label, date, year, lane });
  }
  return text("timeline.entryUndated", { label, lane });
};

// Cuts `label` to `most` code points: whole when it fits, else `most - 1` of them and an ellipsis.
const cut = (label: string, most: number): string => {
  const points = [...label];
  return points.length <= most ? label : `${points.slice(0, most - 1).join("")}…`;
};

/** An entry's label as drawn: its 200 pixels at 7 a character, 28 code points, then an ellipsis. */
export const shownLabel = (label: string): string => cut(label, 28);

/** A lane's label in the fixed column: 14 code points, then an ellipsis; the title holds it whole. */
export const laneText = (label: string): string => cut(label, 14);
