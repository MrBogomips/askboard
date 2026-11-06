// The test-only widget type of the registry (widget-registry, design decision 2): `probe`, an item
// holding a flat list of options, with a result that picks one of them and one derived field. It
// proves at every unit that registering a type is enough. Its schemas have `$id`s of their own and
// belong to no schema set: the widget validator adds them on first use. Tests only; no shipped unit
// imports it, and the shipped registry never holds it.

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
