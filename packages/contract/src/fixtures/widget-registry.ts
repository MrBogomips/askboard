// The test-only widget type of the registry (widget-registry, design decision 2): `probe`, an item
// holding a flat list of options, with a result that picks one of them and one derived field. It
// proves at every unit that registering a type is enough. Its schemas have `$id`s of their own and
// belong to no schema set: the widget validator adds them on first use. Tests only; no shipped unit
// imports it, and the shipped registry never holds it.

import {
  BOARD_DOCUMENT_VERSION,
  type LifecycleBoardDocument,
} from "../schemas/board-document/index.ts";
import {
  type ActCommand,
  BOARD_PROTOCOL_VERSION,
  type DraftRecord,
} from "../schemas/board-protocol/index.ts";
import type { AnswerEvent } from "../schemas/output/index.ts";
import type { SnapshotEvent } from "../schemas/snapshot-data/index.ts";
import { RESULT_VERSIONS } from "../schemas/tool-envelopes/index.ts";
import { WIDGET_TYPES, type WidgetType } from "../widgets/registry.ts";

const OPTION = { type: "object", additionalProperties: false, required: ["id", "label"] } as const;

const propsSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:input:probe-props",
  title: "Probe props",
  description: "The test-only widget's props: a non-empty list of options.",
  type: "object",
  additionalProperties: false,
  required: ["options"],
  properties: {
    options: {
      type: "array",
      minItems: 1,
      items: {
        ...OPTION,
        properties: {
          id: { $ref: "urn:askboard:input:id" },
          label: { type: "string", minLength: 1, maxLength: 200 },
        },
      },
    },
  },
} as const;

const changesSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:probe-changes",
  title: "Probe changes",
  description: "The test-only widget's changes: the output format's changes, defined once.",
  type: "array",
  items: { $ref: "urn:askboard:output:answer-event#/$defs/change" },
} as const;

const resultSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "urn:askboard:output:probe-result",
  title: "Probe result",
  description: "The test-only widget's result: the ID of the option picked.",
  type: "object",
  additionalProperties: false,
  required: ["pick"],
  properties: { pick: { $ref: "urn:askboard:input:id" } },
} as const;

const optionsOf = (props: unknown): readonly string[] => {
  const list =
    typeof props === "object" && props !== null
      ? (props as { options?: unknown }).options
      : undefined;
  return Array.isArray(list)
    ? list.flatMap((option) => (typeof option?.id === "string" ? [option.id] : []))
    : [];
};

/** The test-only type: options, a result `{pick}` and the derived field `count`. */
export const PROBE_WIDGET: WidgetType = {
  type: "probe",
  noun: "a Probe",
  props: propsSchema,
  propsProblems: (props) =>
    optionsOf(props).length === new Set(optionsOf(props)).size
      ? []
      : [{ path: "/options", message: "the options of a probe have unique IDs" }],
  edits: { changes: changesSchema, shape: () => ({ elements: "options" }) },
  result: {
    schema: resultSchema,
    problems: (result, props) => {
      const pick = (result as { pick?: unknown }).pick;
      return typeof pick === "string" && optionsOf(props).includes(pick)
        ? []
        : [
            {
              path: "/pick",
              message: `the option ${JSON.stringify(pick)} is not one of the item's options`,
            },
          ];
    },
  },
  derived: {
    describe: "the count of the options",
    problem: (rest) =>
      rest.length === 1 && rest[0] === "count" ? undefined : "a probe declares count",
  },
  wording: {
    element: (item, rest) => {
      const list = (item as { props?: { options?: unknown } }).props?.options;
      const option: unknown = Array.isArray(list) ? list[Number(rest[2])] : undefined;
      const id = (option as { id?: unknown } | undefined)?.id;
      return rest[1] === "options" && typeof id === "string" ? `option "${id}"` : undefined;
    },
    expected: {
      "probe.props": "a probe's props {options}",
      "probe.props.options": "a non-empty list of options, each {id, label}",
      "probe.props.options[]": "an option {id, label}",
      "probe.props.options[].id": "an ID",
      "probe.props.options[].label": "text of 1 to 200 characters",
    },
    fields: {
      "probe.props": "a probe's props hold only options",
      "probe.props.options[]": "an option holds only id and label",
    },
  },
  example: {
    item: {
      type: "probe",
      id: "pick",
      props: {
        options: [
          { id: "a", label: "Option A" },
          { id: "b", label: "Option B" },
        ],
      },
    },
  },
};

/** The registry the test-only type extends: the shipped types, then `probe`. */
export const PROBE_TYPES: readonly WidgetType[] = [...WIDGET_TYPES, PROBE_WIDGET];

// The results seam, with the test-only type's results (widget-registry, task 2.3): one ask whose
// question `choose` holds the probe's example item `pick`, the user's answer carrying the result
// `{pick: "a"}`, and what each set holds of it. Each takes its `version` from its constant.

const SESSION = {
  epoch: "k3x9",
  askId: "pick-one-t3m9",
  question: "choose",
  item: "pick",
} as const;
const WHEN = "2026-11-06T09:30:00Z";
const WHO = "Sara Conti";
const RESULTS = { [SESSION.item]: { pick: "a" } } as const;

/** The session of the probe fixtures: its epoch, ask, question and the probe item's ID. */
export const PROBE_SESSION = SESSION;

const PROBE_QUESTION = {
  type: "question",
  id: SESSION.question,
  rev: 1,
  props: { text: "Which one?", items: [PROBE_WIDGET.example.item] },
} as const;

/** The ask's board document, as a type this contract's board document cannot name. */
export const probeBoardDocument = {
  version: BOARD_DOCUMENT_VERSION,
  title: "Which one?",
  askId: SESSION.askId,
  items: [PROBE_QUESTION],
} as unknown as LifecycleBoardDocument;

/** The act that sends the user's answer: a result and no edit. */
export const probeResultAct: ActCommand = {
  version: BOARD_PROTOCOL_VERSION,
  type: "act",
  actionId: "pK3mR8nQw2TsL6vXy1cZpE",
  acts: [{ type: "answer", itemId: SESSION.question, rev: 1, results: RESULTS, when: WHEN }],
};

/** The board's unsent work: the result held for Submit. */
export const probeDraftRecord: DraftRecord = {
  delivery: "submitted",
  inView: SESSION.question,
  questions: {
    [SESSION.question]: {
      rev: 1,
      results: RESULTS,
      held: { act: "answer", order: 1 },
    },
  },
};

/** The board state after the answer: the logged results by expanded item ID. */
export const probeBoardState = {
  version: BOARD_PROTOCOL_VERSION,
  type: "state",
  state: {
    ask: "answered",
    questions: [
      {
        itemId: SESSION.question,
        rev: 1,
        state: "answered",
        answer: { results: RESULTS, when: WHEN, receipt: "sent" },
      },
    ],
  },
} as const;

/** The answer event that logs it: results by item ID. */
export const probeAnswerEvent: AnswerEvent = {
  cursor: `${SESSION.epoch}.1`,
  type: "answer",
  itemId: SESSION.question,
  rev: 1,
  who: WHO,
  when: WHEN,
  results: RESULTS,
};

/** The same answer when its content went over the limit: no results; `fetch` has them. */
export const probeTooLargeEvent: AnswerEvent = {
  cursor: `${SESSION.epoch}.1`,
  type: "answer",
  itemId: SESSION.question,
  rev: 1,
  who: WHO,
  when: WHEN,
  tooLarge: true,
};

const fetched = (item: unknown): Readonly<Record<string, unknown>> => ({
  versions: RESULT_VERSIONS,
  epoch: SESSION.epoch,
  askId: SESSION.askId,
  state: "answered",
  item,
  unchecked: true,
});

/** What `fetch` returns for the question: its answer in full, the results among its content. */
export const probeFetchResult = fetched({
  type: "question",
  id: SESSION.question,
  rev: 1,
  props: { text: "Which one?", items: [PROBE_WIDGET.example.item] },
  state: "answered",
  answer: { cursor: `${SESSION.epoch}.1`, results: RESULTS, who: WHO, when: WHEN },
});

/** What `fetch` returns for the probe item alone: its props and its latest answer's result. */
export const probeFetchItemResult = fetched({
  ...PROBE_WIDGET.example.item,
  questionId: SESSION.question,
  state: "answered",
  result: RESULTS[SESSION.item],
});

/** The Snapshot's logged entry of the too-large answer: the results ask-core kept for it. */
export const probeSnapshotEntry: SnapshotEvent = {
  event: probeTooLargeEvent,
  results: RESULTS,
};
