// The Tree's toolbar (design decision 6; DESIGN.md, Widget frame; proposal, open question 10): the
// tools as `button-secondary`s in the widget frame's toolbar row, one Tab stop with the arrow keys,
// Home and End among them, skipping disabled tools (`toolbarFocus`, `toolbarStop`). A disabled
// tool is `aria-disabled` rather than `disabled`, so that a tool that turns disabled under the
// focus, such as "Move up" once its node is first, keeps the focus and the next Enter does
// nothing. Each tool with keys names them in `aria-keyshortcuts` and its title. While a delete
// asks first, its question takes the tools' place (`delete-question.tsx`).

import { type KeyboardEvent, useRef, useState } from "react";
import { TOOL, TOOLBAR, TOOLS } from "./classes.ts";
import { DeleteQuestion } from "./delete-question.tsx";
import type { DeleteQuestion as Question } from "./deleting.ts";
import { treeKeyOf } from "./key-event.ts";
import type { TreeEdit } from "./model/edits.ts";
import { toolbarFocus, toolbarStop } from "./model/focus.ts";
import { TREE_TOOLS, type TreeTool, toolbarKey } from "./model/keys.ts";

/** The toolbar's name; the question's text names the tree. The wording is not recorded in EXPERIENCE.md. */
const TOOLBAR_NAME = "Tree tools";

// "Move up (Alt+Shift+ArrowUp)", "Delete (Delete or Backspace)"; a tool with no keys has none.
const titleOf = ({ label, shortcut }: TreeTool): string | undefined =>
  shortcut === undefined ? undefined : `${label} (${shortcut.split(" ").join(" or ")})`;

/** A delete's question, while it is asked, and its answers. */
export type Asking = {
  /** The node the question is about: a question about another node opens anew, on "Cancel". */
  readonly nodeId: string;
  readonly question: Question;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export const TreeToolbar = ({
  ref,
  enabled,
  onTool,
  asking,
}: {
  /** The toolbar row's element, the tools' or the question's, for the Tree's focus. */
  readonly ref: (row: HTMLElement | null) => void;
  /** Whether each of `TREE_TOOLS` is enabled, in order. */
  readonly enabled: readonly boolean[];
  /** An enabled tool was chosen, by a click, Enter or Space. */
  readonly onTool: (edit: TreeEdit) => void;
  readonly asking: Asking | undefined;
}) => {
  // The tool focused last, which keeps the Tab stop while it is enabled.
  const [current, setCurrent] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const stop = toolbarStop(enabled, current);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const move = toolbarKey(treeKeyOf(event));
    if (move === undefined) return;
    event.preventDefault();
    buttons.current[toolbarFocus(enabled, current, move)]?.focus();
  };

  if (asking !== undefined) {
    const { nodeId, ...answers } = asking;
    return <DeleteQuestion key={nodeId} ref={ref} {...answers} />;
  }
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={TOOLBAR_NAME}
      className={TOOLBAR}
      onKeyDown={onKeyDown}
    >
      <div className={TOOLS}>
        {TREE_TOOLS.map((tool, at) => (
          <button
            key={tool.edit}
            ref={(button) => {
              buttons.current[at] = button;
            }}
            type="button"
            tabIndex={at === stop ? 0 : -1}
            aria-disabled={enabled[at] === true ? undefined : true}
            aria-keyshortcuts={tool.shortcut}
            title={titleOf(tool)}
            className={TOOL}
            onFocus={() => setCurrent(at)}
            onClick={() => {
              if (enabled[at] === true) onTool(tool.edit);
            }}
          >
            {tool.label}
          </button>
        ))}
      </div>
    </div>
  );
};
