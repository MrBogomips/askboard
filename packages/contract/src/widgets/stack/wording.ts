// How a request's wording reads a Stack's props (layouts, design decision 1), keyed
// `stack.props.items[].type`. Nothing here validates.

import { LAYOUT_CHILD_FIELDS, LAYOUT_CHILD_ITEM, LAYOUT_CHILD_TYPE } from "../shared/layouts.ts";

export const STACK_EXPECTED: Readonly<Record<string, string>> = {
  "stack.props": "a Stack's props {items}",
  "stack.props.items": "a non-empty list of the items to show one under another",
  "stack.props.items[]": LAYOUT_CHILD_ITEM,
  "stack.props.items[].type": LAYOUT_CHILD_TYPE,
};

export const STACK_FIELDS: Readonly<Record<string, string>> = {
  "stack.props": "a Stack's props hold only items",
  "stack.props.items[]": LAYOUT_CHILD_FIELDS,
};
