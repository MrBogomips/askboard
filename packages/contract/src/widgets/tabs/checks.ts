// The Tabs layout's rules that its schema cannot say (layouts, design decision 4): the tab IDs
// unique within the item, and none of them starting with the prefix the view makes its own IDs
// with. Plain ECMAScript with no JSON and no Ajv. Nothing here throws on a value it cannot read.

import { VIEW_ID_PREFIX } from "../../constants.ts";
import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";

/** What a schema-valid Tabs' props still get wrong: a tab ID held twice, or one that starts with `u-`. */
export const tabsPropsProblems = (props: unknown): readonly Problem[] => {
  const tabs = isRecord(props) && Array.isArray(props.tabs) ? props.tabs : [];
  const seen = new Set<string>();
  const problems: Problem[] = [];
  tabs.forEach((tab, index) => {
    const id = isRecord(tab) ? tab.id : undefined;
    if (typeof id !== "string") return;
    if (id.startsWith(VIEW_ID_PREFIX)) {
      problems.push({
        path: `/tabs/${index}/id`,
        message: `the tab ID "${id}" starts with "${VIEW_ID_PREFIX}", which the board keeps for the IDs it makes itself`,
      });
    }
    if (seen.has(id)) {
      problems.push({
        path: `/tabs/${index}/id`,
        message: `the tab ID "${id}" is held twice: each tab of a Tabs layout has an ID of its own`,
      });
    }
    seen.add(id);
  });
  return problems;
};
