// The Tree's toolbar row (design decision 6; DESIGN.md, Widget frame; proposal, open questions 10
// and 14): the tools as `button-secondary`s, one Tab stop with the arrow keys, Home and End among
// them, skipping disabled tools (`toolbarFocus`, `toolbarStop`), then the counter of the user's
// changes at the row's right. A disabled tool is `aria-disabled` rather than `disabled`, so that a
// tool that turns disabled under the focus, such as "Move up" once its node is first, keeps the
// focus and the next Enter does nothing. Each tool with keys names them in `aria-keyshortcuts` and
// its title. While a delete asks first, its question takes the tools' place and the counter keeps
// its own (`delete-question.tsx`). The counter truncates before it overprints a tool; when the row
// cannot hold all the tools and the counter's minimum, the move tools go into a "More" menu, the
// last stop of the toolbar (`model/overflow.ts`, review F-16).

import { type Say, useLanguage, useStrings } from "@askboard/view/catalog";
import { DropdownMenu } from "radix-ui";
import { type KeyboardEvent, type Ref, useRef, useState } from "react";
import {
  CHANGE_DOT,
  COUNTER,
  COUNTER_TEXT,
  MENU,
  MENU_ITEM,
  TOOL,
  TOOLBAR,
  TOOLS,
} from "./classes.ts";
import { DeleteQuestion } from "./delete-question.tsx";
import type { DeleteQuestion as Question } from "./deleting.ts";
import { treeKeyOf } from "./key-event.ts";
import type { TreeEdit } from "./model/edits.ts";
import { toolbarFocus, toolbarStop } from "./model/focus.ts";
import { TREE_TOOLS, type TreeTool, toolbarKey } from "./model/keys.ts";
import { MOVE_TOOLS } from "./model/overflow.ts";
import { useCrowded } from "./use-crowded.ts";

// The counter: "No changes", then each node the user changed, once, after the change dot; cut with
// an ellipsis, its whole text in the tooltip, before it overprints a tool.
const ChangeCount = ({ count }: { readonly count: number }) => {
  const text = useStrings();
  const words = count === 0 ? text("widget.noChanges") : text("widget.yourChanges", { count });
  return (
    <p className={COUNTER} title={words}>
      {count === 0 ? null : <span aria-hidden="true" className={CHANGE_DOT} />}
      <span className={COUNTER_TEXT}>{words}</span>
    </p>
  );
};

// "Move up (Alt+Shift+ArrowUp)", "Delete (Delete or Backspace)"; a tool with no keys has none.
const titleOf = ({ label, shortcut }: TreeTool, text: Say): string | undefined =>
  shortcut === undefined
    ? undefined
    : `${text(label)} (${shortcut.split(" ").join(text("tree.keysSeparator"))})`;

/** A delete's question, while it is asked, and its answers. */
export type Asking = {
  /** The node the question is about: a question about another node opens anew, on "Cancel". */
  readonly nodeId: string;
  readonly question: Question;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

// The tools of `TREE_TOOLS` the row shows, by index: all of them, or, when crowded, all but the
// moves, which "More" holds.
const shownTools = (crowded: boolean): readonly number[] =>
  TREE_TOOLS.flatMap((tool, at) => (crowded && MOVE_TOOLS.has(tool.edit) ? [] : [at]));

// The "More" menu, the last stop of the toolbar: the move tools, each disabled as its tool is. It
// is not modal, as the question card's, so it locks no scroll and adds no style element.
const MoreMenu = ({
  buttonRef,
  tabIndex,
  enabled,
  onTool,
  onFocus,
}: {
  readonly buttonRef: (button: HTMLButtonElement | null) => void;
  readonly tabIndex: 0 | -1;
  readonly enabled: readonly boolean[];
  readonly onTool: (edit: TreeEdit) => void;
  readonly onFocus: () => void;
}) => {
  const text = useStrings();
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          ref={buttonRef}
          type="button"
          tabIndex={tabIndex}
          className={TOOL}
          onFocus={onFocus}
        >
          {text("widget.more")}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={4} className={MENU}>
          {TREE_TOOLS.flatMap((tool, at) =>
            MOVE_TOOLS.has(tool.edit)
              ? [
                  <DropdownMenu.Item
                    key={tool.edit}
                    className={MENU_ITEM}
                    disabled={enabled[at] !== true}
                    title={titleOf(tool, text)}
                    onSelect={() => onTool(tool.edit)}
                  >
                    {text(tool.label)}
                  </DropdownMenu.Item>,
                ]
              : [],
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export const TreeToolbar = ({
  ref,
  enabled,
  onTool,
  asking,
  changes,
}: {
  /** The toolbar row's element, holding the tools or the question, for the Tree's focus. */
  readonly ref: Ref<HTMLDivElement>;
  /** Whether each of `TREE_TOOLS` is enabled, in order. */
  readonly enabled: readonly boolean[];
  /** An enabled tool was chosen, by a click, Enter or Space. */
  readonly onTool: (edit: TreeEdit) => void;
  readonly asking: Asking | undefined;
  /** How many nodes the user changed against the agent's value (`marksOf`'s count). */
  readonly changes: number;
}) => {
  // The stop focused last, which keeps the Tab stop while it is enabled: a position among the
  // shown tools, then "More" when it is shown.
  const text = useStrings();
  const [current, setCurrent] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const toolsRow = useRef<HTMLDivElement>(null);
  const crowded = useCrowded(toolsRow, useLanguage(), asking === undefined);
  const shown = shownTools(crowded);
  // Each stop's enabled state: the shown tools', then "More", which is always enabled.
  const stops = [...shown.map((at) => enabled[at] === true), ...(crowded ? [true] : [])];
  const stop = toolbarStop(stops, current);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // The "More" menu is portaled out of the toolbar but its keys bubble here: they are the menu's.
    if (!event.currentTarget.contains(event.target as Node)) return;
    const move = toolbarKey(treeKeyOf(event));
    if (move === undefined) return;
    event.preventDefault();
    buttons.current[toolbarFocus(stops, current, move)]?.focus();
  };

  const tools = (
    <div
      ref={toolsRow}
      role="toolbar"
      aria-label={text("tree.tools.name")}
      className={TOOLS}
      onKeyDown={onKeyDown}
    >
      {shown.map((index, at) => {
        const tool = TREE_TOOLS[index] as TreeTool;
        return (
          <button
            key={tool.edit}
            ref={(button) => {
              buttons.current[at] = button;
            }}
            type="button"
            tabIndex={at === stop ? 0 : -1}
            aria-disabled={enabled[index] === true ? undefined : true}
            aria-keyshortcuts={tool.shortcut}
            title={titleOf(tool, text)}
            className={TOOL}
            onFocus={() => setCurrent(at)}
            onClick={() => {
              if (enabled[index] === true) onTool(tool.edit);
            }}
          >
            {text(tool.label)}
          </button>
        );
      })}
      {crowded ? (
        <MoreMenu
          buttonRef={(button) => {
            buttons.current[shown.length] = button;
          }}
          tabIndex={shown.length === stop ? 0 : -1}
          enabled={enabled}
          onTool={onTool}
          onFocus={() => setCurrent(shown.length)}
        />
      ) : null}
    </div>
  );
  return (
    <div ref={ref} className={TOOLBAR}>
      {asking === undefined ? (
        tools
      ) : (
        <DeleteQuestion
          key={asking.nodeId}
          question={asking.question}
          onConfirm={asking.onConfirm}
          onCancel={asking.onCancel}
        />
      )}
      <ChangeCount count={changes} />
    </div>
  );
};
