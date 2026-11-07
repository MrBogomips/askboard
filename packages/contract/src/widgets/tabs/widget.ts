// The Tabs layout's registry entry (layouts, design decisions 1 and 3): its schema, check, wording,
// example and teaching text. It imports no runtime value of `validate.ts`, `sets.ts` or a schema
// set module (the registry's import rule). A Tabs layout gives no result, edits nothing and
// derives nothing.

import type { WidgetType } from "../registry.ts";
import { tabsPropsProblems } from "./checks.ts";
import tabsProps from "./tabs-props.json" with { type: "json" };
import { TABS_EXPECTED, TABS_FIELDS, tabsElementOf } from "./wording.ts";

export const TABS_WIDGET: WidgetType = {
  type: "tabs",
  noun: "a Tabs layout",
  props: tabsProps,
  propsProblems: tabsPropsProblems,
  wording: { expected: TABS_EXPECTED, fields: TABS_FIELDS, element: tabsElementOf },
  example: {
    item: {
      type: "tabs",
      id: "arrange-tabs",
      props: {
        tabs: [
          {
            id: "costs",
            title: "Costs",
            items: [{ type: "number-field", id: "arrange-tabs-cost", props: { label: "Cost" } }],
          },
          {
            id: "notes",
            title: "Notes",
            items: [{ type: "text-field", id: "arrange-tabs-note", props: { label: "Note" } }],
          },
        ],
      },
    },
  },
  skill: {
    use: "2 to 8 titled tabs, each holding items",
    notes: [
      "Each tab is `{id, title, items}` with an ID unique in the Tabs; its items hold atoms, widgets and other layouts. The user sees one tab at a time, and every tab keeps its answers.",
    ],
  },
};
