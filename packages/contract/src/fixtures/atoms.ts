// The atoms' fixtures (atoms, design decisions 1 and 10): `ATOM_TYPES`, the entries a test gives
// the shipped registry through `withWidgetTypes` while a type is not registered yet, and each
// type's example items and results. Tests only; no shipped unit imports them.

import { DIVIDER_WIDGET } from "../widgets/divider/widget.ts";
import type { WidgetType } from "../widgets/registry.ts";
import { TEXT_WIDGET } from "../widgets/text/widget.ts";
import { VALUE_WIDGET } from "../widgets/value/widget.ts";

/**
 * The atoms' entries in the registry's order: the display atoms, then the input atoms. A test
 * passes them to `withWidgetTypes(...ATOM_TYPES)`; the same test passes before and after a type
 * joins `WIDGET_TYPES`.
 */
export const ATOM_TYPES: readonly WidgetType[] = [TEXT_WIDGET, VALUE_WIDGET, DIVIDER_WIDGET];

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
