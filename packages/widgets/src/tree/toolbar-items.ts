// The toolbar's items (design decision 6; tree-edit-undo design decision 5), pure: each button of
// the row, a Tree tool or a selection or adjustment tool, in order, with its label, its enabled
// state, its title and its keys. Kept apart from the component so that a unit test can check the
// items against the key table.

import { TREE_KEYS } from "@askboard/contract";
import { type KeyPlatform, keyLabel, type Say, type StringKey } from "@askboard/view/catalog";
import type { TreeEdit } from "./model/edits.ts";
import { TREE_TOOLS, type TreeTool } from "./model/keys.ts";
import { OVERFLOW_TOOLS } from "./model/overflow.ts";
import { selectAll } from "./model/selection.ts";
import type { SelectionTools } from "./toolbar.tsx";

// "Move up (Alt+Shift+ArrowUp)", "Delete (Delete or Backspace)"; a tool with no keys has none.
const titleOf = ({ label, shortcut }: TreeTool, text: Say): string | undefined =>
  shortcut === undefined
    ? undefined
    : `${text(label)} (${shortcut.split(" ").join(text("tree.keysSeparator"))})`;

// One button of the row: a Tree tool, or a selection or adjustment tool, in order.
export type Item = {
  readonly key: string;
  readonly label: StringKey;
  readonly enabled: boolean;
  readonly title?: string;
  readonly shortcut?: string;
  /** The tool's marker, which no language changes. */
  readonly marker?: string;
  /** Goes into "More" when the row is crowded. */
  readonly overflow: boolean;
  readonly run: () => void;
};

/** "Undo (⌘Z)", "Undo (Ctrl+Z)": the tool's name and its key as the platform writes it (D5). */
export const undoTitle = (platform: KeyPlatform, text: Say): string => {
  const binding = TREE_KEYS.find((entry) => entry.action === "undo")?.keys[0];
  const name = text("tree.tool.undo");
  return binding === undefined ? name : `${name} (${keyLabel(binding, platform, text)})`;
};

export const itemsOf = (
  enabled: readonly boolean[],
  onTool: (edit: TreeEdit) => void,
  tools: SelectionTools,
  open: () => void,
  text: Say,
  platform: KeyPlatform,
): readonly Item[] => {
  const some = tools.selection.size > 0;
  const own: Item[] = [
    {
      key: "selectAll",
      label: "tree.select.all",
      // Nothing to select in an empty Tree, which leaves its toolbar stop to "Add node".
      enabled: selectAll(tools.value).size > 0,
      overflow: true,
      run: tools.onSelectAll,
    },
    {
      key: "selectNone",
      label: "tree.select.none",
      enabled: some,
      overflow: true,
      run: tools.onSelectNone,
    },
    {
      key: "adjust",
      label: "tree.tool.adjust",
      enabled: some && !tools.disabled,
      overflow: false,
      run: open,
    },
  ];
  own.push({
    key: "undo",
    label: "tree.tool.undo",
    enabled: tools.canUndo && !tools.disabled,
    title: undoTitle(platform, text),
    shortcut: "Control+Z Meta+Z",
    marker: "",
    overflow: false,
    run: tools.onUndo,
  });
  const treeTools = TREE_TOOLS.map(
    (tool, at): Item => ({
      key: tool.edit,
      label: tool.label,
      enabled: enabled[at] === true,
      title: titleOf(tool, text),
      shortcut: tool.shortcut,
      overflow: OVERFLOW_TOOLS.has(tool.edit),
      run: () => onTool(tool.edit),
    }),
  );
  return [...treeTools, ...own];
};
