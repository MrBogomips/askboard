// The layouts' fixtures (layouts, design decisions 1 and 8): `LAYOUT_WIDGETS`, the entries a test
// gives the shipped registry through `withWidgetTypes` while the layouts are not registered, and a
// question arranged with them. Tests only; no shipped unit imports them. Item IDs here are used
// by no other fixture.

import { GROUP_WIDGET } from "../widgets/group/widget.ts";
import type { WidgetType } from "../widgets/registry.ts";
import { ROW_WIDGET } from "../widgets/row/widget.ts";
import { STACK_WIDGET } from "../widgets/stack/widget.ts";
import { TABS_WIDGET } from "../widgets/tabs/widget.ts";

/**
 * The layouts' entries in the registry's order. A test passes them to
 * `withWidgetTypes(...LAYOUT_WIDGETS)`; the same test passes before and after they join
 * `WIDGET_TYPES`.
 */
export const LAYOUT_WIDGETS: readonly WidgetType[] = [
  STACK_WIDGET,
  ROW_WIDGET,
  GROUP_WIDGET,
  TABS_WIDGET,
];

/**
 * A Tabs whose first tab holds a Group of a Row of a TextField and a NumberField, and whose second
 * tab holds a Stack of a Toggle and a Divider.
 */
export const ARRANGED_ITEM = {
  type: "tabs",
  id: "plan-tabs",
  props: {
    tabs: [
      {
        id: "people",
        title: "People",
        items: [
          {
            type: "group",
            id: "plan-group",
            props: {
              title: "Owner",
              items: [
                {
                  type: "row",
                  id: "plan-row",
                  props: {
                    items: [
                      { type: "text-field", id: "plan-owner", props: { label: "Owner" } },
                      {
                        type: "number-field",
                        id: "plan-hours",
                        props: { label: "Hours", min: 0, max: 40 },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
      {
        id: "options",
        title: "Options",
        items: [
          {
            type: "stack",
            id: "plan-stack",
            props: {
              items: [
                { type: "toggle", id: "plan-notify", props: { label: "Notify the team" } },
                { type: "divider", id: "plan-rule", props: {} },
              ],
            },
          },
        ],
      },
    ],
  },
} as const;
