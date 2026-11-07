// The atoms' fixtures (atoms, design decisions 1 and 10): `ATOM_TYPES`, the entries a test gives
// the shipped registry through `withWidgetTypes` while a type is not registered yet, and each
// type's example items and results. Tests only; no shipped unit imports them.

import { DIVIDER_WIDGET } from "../widgets/divider/widget.ts";
import type { WidgetType } from "../widgets/registry.ts";
import { TEXT_WIDGET } from "../widgets/text/widget.ts";
import { TEXT_FIELD_WIDGET } from "../widgets/text-field/widget.ts";
import { TOGGLE_WIDGET } from "../widgets/toggle/widget.ts";
import { VALUE_WIDGET } from "../widgets/value/widget.ts";

/**
 * The atoms' entries in the registry's order: the display atoms, then the input atoms. A test
 * passes them to `withWidgetTypes(...ATOM_TYPES)`; the same test passes before and after a type
 * joins `WIDGET_TYPES`.
 */
export const ATOM_TYPES: readonly WidgetType[] = [
  TEXT_WIDGET,
  VALUE_WIDGET,
  DIVIDER_WIDGET,
  TEXT_FIELD_WIDGET,
  TOGGLE_WIDGET,
];

/** A plain Text and a Markdown one. */
export const TEXT_FIXTURE_ITEMS = [
  { type: "text", id: "intro", props: { text: "Pick the plan that fits the budget." } },
  {
    type: "text",
    id: "notes",
    props: {
      text: "# Notes\n\n- one **bold** point\n- a [link](https://example.com/spec)",
      format: "markdown",
    },
  },
] as const;

/** A Value of each kind. */
export const VALUE_FIXTURE_ITEMS = [
  { type: "value", id: "headcount", props: { label: "Headcount", kind: "number", value: 12 } },
  {
    type: "value",
    id: "weight",
    props: { label: "Weight", kind: "number", value: 1234.5, unit: "kg" },
  },
  { type: "value", id: "margin", props: { label: "Margin", kind: "percent", value: 0.185 } },
  {
    type: "value",
    id: "budget",
    props: { label: "Budget", kind: "money", amount: "12480.50", currency: "EUR" },
  },
  { type: "value", id: "due", props: { label: "Due", kind: "date", date: "2026-12-09" } },
  { type: "value", id: "effort", props: { label: "Effort", kind: "duration", days: 12 } },
] as const;

/** A Divider. */
export const DIVIDER_FIXTURE_ITEM = { type: "divider", id: "rule", props: {} } as const;

/** A TextField of each form: short, multiline, and capped. */
export const TEXT_FIELD_FIXTURE_ITEMS = [
  { type: "text-field", id: "name", props: { label: "Name", maxLength: 40 } },
  {
    type: "text-field",
    id: "comment",
    props: { label: "Comment", description: "Anything the reviewer should know.", multiline: true },
  },
  { type: "text-field", id: "ticket", props: { label: "Ticket" } },
] as const;

/** A result of each TextField above, in order. */
export const TEXT_FIELD_RESULTS = ["Ada Lovelace", "First line\nsecond line", "ASK-142"] as const;

/** A Toggle. */
export const TOGGLE_FIXTURE_ITEM = {
  type: "toggle",
  id: "notify",
  props: { label: "Notify me when it ships", description: "One message, no reminders." },
} as const;

/** A Toggle's results: on, and off, which is an answer. */
export const TOGGLE_RESULTS = { on: true, off: false } as const;
