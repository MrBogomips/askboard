// The values the view shows, as the view formats them (settings-languages, task 7.3): each case
// is a message time at a fixed offset, in both locales, so its text never depends on the runtime's
// time zone or locale (AD-13).

import { timeOf } from "../../src/shell/thread-text.ts";

export type ViewCase = {
  readonly name: string;
  readonly when: string;
  readonly offset: number;
  readonly "en-US": string;
  readonly "it-IT": string;
};

export const VIEW_CASES: readonly ViewCase[] = [
  {
    name: "afternoon at UTC",
    when: "2026-10-31T17:42:05Z",
    offset: 0,
    "en-US": "5:42 PM",
    "it-IT": "17:42",
  },
  {
    name: "morning at +01:00",
    when: "2026-10-31T08:05:00Z",
    offset: 60,
    "en-US": "9:05 AM",
    "it-IT": "09:05",
  },
  {
    name: "midnight at +14:00",
    when: "2026-10-31T10:00:00Z",
    offset: 840,
    "en-US": "12:00 AM",
    "it-IT": "00:00",
  },
  {
    name: "noon at -10:00",
    when: "2026-10-31T22:00:00Z",
    offset: -600,
    "en-US": "12:00 PM",
    "it-IT": "12:00",
  },
];

/** Every case's text in both locales, by name. */
export const viewResults = (): Record<string, readonly [string, string]> =>
  Object.fromEntries(
    VIEW_CASES.map((entry) => [
      entry.name,
      [timeOf(entry.when, "en-US", entry.offset), timeOf(entry.when, "it-IT", entry.offset)],
    ]),
  );

/** A message time at the viewer's own offset, in both locales, for the time zone check. */
export const viewerTimes = (when: string): readonly [string, string] => [
  timeOf(when, "en-US"),
  timeOf(when, "it-IT"),
];
