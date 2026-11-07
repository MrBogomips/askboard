// The Timeline's rules that its schemas cannot say (latex-kanban-timeline, design decision 5): the
// lane and entry IDs unique within the item (AD-7), each entry's lane one of the item's lanes, an
// entry that is a milestone (`date` alone) or a range (`start` and `end`), every day one that
// exists within the Gantt's first and last days, and an `end` on or after its `start`. Problems
// name the element, `entry "checkout"`. One object schema with optional dates and the rule here
// give one worded problem, where a `oneOf` would give a list of failed branches.
//
// Plain ECMAScript with no JSON and no Ajv: the timeline chunk bundles it. Nothing here throws on a
// value it cannot read: it checks only the parts the schema's shape would let through, and the
// registry runs it after the schema.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";
import { isGanttDate } from "../gantt/checks.ts";
import { GANTT_FIRST_DATE, GANTT_LAST_DATE } from "../gantt/index.ts";

type Entry = { readonly id: string; readonly path: string };

const DAYS = `a day from ${GANTT_FIRST_DATE} to ${GANTT_LAST_DATE}`;
const DATE_FIELDS = ["date", "start", "end"] as const;

// The elements of a list that have a string ID, in order, with the path of the element.
const entriesOf = (props: Record<string, unknown>, key: string): Entry[] => {
  const list = props[key];
  if (!Array.isArray(list)) return [];
  return list.flatMap((element, index) => {
    const id = isRecord(element) ? element.id : undefined;
    return typeof id === "string" ? [{ id, path: `/${key}/${index}` }] : [];
  });
};

const idProblems = (lanes: readonly Entry[], entries: readonly Entry[]): Problem[] => {
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const kind = new Map<Entry, string>([
    ...lanes.map((lane): [Entry, string] => [lane, "lane"]),
    ...entries.map((entry): [Entry, string] => [entry, "entry"]),
  ]);
  for (const [{ id, path }, noun] of kind) {
    if (seen.has(id)) {
      problems.push({
        path: `${path}/id`,
        message: `the ID "${id}" is held twice: each lane and entry of a Timeline has an ID of its own (${noun} "${id}")`,
      });
    }
    seen.add(id);
  }
  return problems;
};

// The problems of one entry's lane and days.
const entryProblems = (entry: Record<string, unknown>, path: string, lanes: Set<string>) => {
  const problems: Problem[] = [];
  const name = `entry "${String(entry.id)}"`;
  const at = (field: string, message: string) =>
    problems.push({ path: `${path}${field}`, message: `${name}: ${message}` });
  if (typeof entry.lane === "string" && !lanes.has(entry.lane)) {
    at("/lane", `its lane "${entry.lane}" is no lane of the item`);
  }
  const held = DATE_FIELDS.filter((field) => entry[field] !== undefined);
  const isMilestone = held.length === 1 && held[0] === "date";
  const isRange = held.length === 2 && held[0] === "start" && held[1] === "end";
  if (!isMilestone && !isRange) {
    at("", "an entry holds `date` alone, a milestone, or `start` and `end`, a range");
  }
  for (const field of held) {
    const value = entry[field];
    if (typeof value === "string" && !isGanttDate(value)) {
      at(`/${field}`, `${field} ${JSON.stringify(value)} is not ${DAYS}`);
    }
  }
  const { start, end } = entry;
  if (isGanttDate(start) && isGanttDate(end) && end < start) {
    at("/end", `the end ${end} is before the start ${start}`);
  }
  return problems;
};

/**
 * What a schema-valid Timeline's props still get wrong: an ID held twice across the lanes and the
 * entries, an entry in no lane, an entry that holds neither `date` alone nor `start` and `end`, a
 * day that does not exist or lies outside the Gantt's days, and an `end` before its `start`.
 * Props that are no object give one problem; a list that is not one is the schema's.
 */
export const timelinePropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) {
    return [{ path: "/", message: "a Timeline's props are an object {lanes, entries}" }];
  }
  const lanes = entriesOf(props, "lanes");
  const entries = entriesOf(props, "entries");
  const held = new Set(lanes.map(({ id }) => id));
  const list = Array.isArray(props.entries) ? props.entries : [];
  return [
    ...idProblems(lanes, entries),
    ...list.flatMap((entry, index) =>
      isRecord(entry) ? entryProblems(entry, `/entries/${index}`, held) : [],
    ),
  ];
};
