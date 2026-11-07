// How a request's wording reads a Group's props (layouts, design decision 1), keyed
// `group.props.title`. Nothing here validates.

import { LAYOUT_CHILD_FIELDS, LAYOUT_CHILD_ITEM, LAYOUT_CHILD_TYPE } from "../shared/layouts.ts";
import { text } from "../wording-parts.ts";
import { GROUP_DESCRIPTION_MAX_CHARS, GROUP_TITLE_MAX_CHARS } from "./constants.ts";

export const GROUP_EXPECTED: Readonly<Record<string, string>> = {
  "group.props": "a Group's props {title, description?, items}",
  "group.props.title": text(GROUP_TITLE_MAX_CHARS),
  "group.props.description": text(GROUP_DESCRIPTION_MAX_CHARS),
  "group.props.items": "a non-empty list of the items the group holds",
  "group.props.items[]": LAYOUT_CHILD_ITEM,
  "group.props.items[].type": LAYOUT_CHILD_TYPE,
};

export const GROUP_FIELDS: Readonly<Record<string, string>> = {
  "group.props": "a Group's props hold only title, description and items",
  "group.props.items[]": LAYOUT_CHILD_FIELDS,
};
