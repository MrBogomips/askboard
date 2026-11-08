// The Tree's toolbar row (design decision 6; DESIGN.md, Widget frame; proposal, open questions 10
// and 14): the tools as `button-secondary`s, one Tab stop with the arrow keys, Home and End among
// them, skipping disabled tools (`toolbarFocus`, `toolbarStop`), then the counter of the user's
// changes at the row's right. A disabled tool is `aria-disabled` rather than `disabled`, so that a
// tool that turns disabled under the focus, such as "Move up" once its node is first, keeps the
// focus and the next Enter does nothing. Each tool with keys names them in `aria-keyshortcuts` and
// its title. While a delete asks first, its question takes the tools' place and the counter keeps
// its own (`delete-question.tsx`). The counter truncates before it overprints a tool; when the row
// cannot hold all the tools and the counter's minimum, the move tools go into a "More" menu, the
// last stop of the toolbar (`model/overflow.ts`, review F-16). A leaf about to become a group asks in
// the same place, by the same pattern (`group-question.tsx`); the row shows one question at a time.

import type { TreeProps } from "@askboard/contract";
import type { StringKey } from "@askboard/view/catalog";
import { type Say, useLanguage, useStrings } from "@askboard/view/catalog";
import { DropdownMenu, Popover } from "radix-ui";
import { type KeyboardEvent, type Ref, useRef, useState } from "react";
import { toolbarFocus, toolbarStop } from "../shared/toolbar-focus.ts";
import { AdjustPanel, type Applied } from "./adjust-panel.tsx";
import {
  CHANGE_DOT,
  COUNTER,
  COUNTER_TEXT,
  MENU,
  MENU_ITEM,
  SELECTION_COUNT,
  STATUS,
  TOOL,
  TOOLBAR,
  TOOLBAR_GROUP,
  TOOLS,
} from "./classes.ts";
import { DeleteQuestion } from "./delete-question.tsx";
import type { DeleteQuestion as Question } from "./deleting.ts";
import { GroupQuestion } from "./group-question.tsx";
import type { GroupQuestion as GroupQuestionWords } from "./grouping.ts";
import { treeKeyOf } from "./key-event.ts";
import type { TreeEdit } from "./model/edits.ts";
import { TREE_TOOLS, type TreeTool, toolbarKey } from "./model/keys.ts";
import { OVERFLOW_TOOLS } from "./model/overflow.ts";
import { type Selection, selectAll } from "./model/selection.ts";
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

/** The answers to a question, whichever it is. */
type Answers = {
  /** What the question is about: a question about another node or edit opens anew, on "Cancel". */
  readonly key: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

/** The question the toolbar row shows in place of the tools: a delete's, or a leaf becoming a group. */
export type Asking =
  | (Answers & { readonly kind: "delete"; readonly question: Question })
  | (Answers & { readonly kind: "group"; readonly question: GroupQuestionWords });

/** The selection and bulk adjustment tools of the toolbar (spec, Tree row selection and bulk adjustment). */
export type SelectionTools = {
  readonly selection: Selection;
  /** The Tree, for the panel's columns and preview. */
  readonly value: TreeProps;
  /** The Tree is read-only: "Adjust by %…" is disabled, the selection controls still select. */
  readonly disabled: boolean;
  readonly onSelectAll: () => void;
  readonly onSelectNone: () => void;
  readonly onApply: (applied: Applied) => void;
  /** Undoes the last adjustment; `undefined` once there is none to undo. */
  readonly onUndo: (() => void) | undefined;
};

// One button of the row: a Tree tool, or a selection or adjustment tool, in order.
type Item = {
  readonly key: string;
  readonly label: StringKey;
  readonly enabled: boolean;
  readonly title?: string;
  readonly shortcut?: string;
  /** Goes into "More" when the row is crowded. */
  readonly overflow: boolean;
  readonly run: () => void;
};

const SELECTION_TOOLS: ReadonlySet<string> = new Set([
  "selectAll",
  "selectNone",
  "adjust",
  "undoAdjust",
]);

const itemsOf = (
  enabled: readonly boolean[],
  onTool: (edit: TreeEdit) => void,
  tools: SelectionTools,
  open: () => void,
  text: Say,
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
  if (tools.onUndo !== undefined) {
    own.push({
      key: "undoAdjust",
      label: "tree.tool.undoAdjust",
      enabled: !tools.disabled,
      shortcut: "Control+Z Meta+Z",
      overflow: false,
      run: tools.onUndo,
    });
  }
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

// The "More" menu, the last stop of the toolbar: the tools given up when crowded, each disabled as
// its tool is. It is not modal, as the question card's, so it locks no scroll and adds no style element.
const MoreMenu = ({
  buttonRef,
  tabIndex,
  items,
  onFocus,
}: {
  readonly buttonRef: (button: HTMLButtonElement | null) => void;
  readonly tabIndex: 0 | -1;
  readonly items: readonly Item[];
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
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.key}
              className={MENU_ITEM}
              disabled={!item.enabled}
              title={item.title}
              onSelect={item.run}
            >
              {text(item.label)}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

// The one question, as its kind says.
const AskedQuestion = ({ asking }: { readonly asking: Asking }) =>
  asking.kind === "delete" ? (
    <DeleteQuestion
      question={asking.question}
      onConfirm={asking.onConfirm}
      onCancel={asking.onCancel}
    />
  ) : (
    <GroupQuestion
      question={asking.question}
      onConfirm={asking.onConfirm}
      onCancel={asking.onCancel}
    />
  );

export const TreeToolbar = ({
  ref,
  enabled,
  onTool,
  asking,
  changes,
  selecting,
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
  readonly selecting: SelectionTools;
}) => {
  // The stop focused last, which keeps the Tab stop while it is enabled: a position among the
  // shown tools, then "More" when it is shown.
  const text = useStrings();
  const [current, setCurrent] = useState(0);
  const [panel, setPanel] = useState(false);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const toolsRow = useRef<HTMLDivElement>(null);
  const crowded = useCrowded(toolsRow, useLanguage(), asking === undefined);
  const items = itemsOf(enabled, onTool, selecting, () => setPanel(true), text);
  const shown = items.filter((item) => !(crowded && item.overflow));
  const given = items.filter((item) => crowded && item.overflow);
  // Each stop's enabled state: the shown tools', then "More", which is always enabled.
  const stops = [...shown.map((item) => item.enabled), ...(crowded ? [true] : [])];
  const stop = toolbarStop(stops, current);
  const adjustAt = shown.findIndex((item) => item.key === "adjust");
  const count = selecting.selection.size;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // The "More" menu and the panel are portaled out of the toolbar but their keys bubble here: they are theirs.
    if (!event.currentTarget.contains(event.target as Node)) return;
    const move = toolbarKey(treeKeyOf(event));
    if (move === undefined) return;
    event.preventDefault();
    buttons.current[toolbarFocus(stops, current, move)]?.focus();
  };

  const button = (item: Item, at: number) => (
    <button
      key={item.key}
      ref={(node) => {
        buttons.current[at] = node;
      }}
      type="button"
      tabIndex={at === stop ? 0 : -1}
      aria-disabled={item.enabled ? undefined : true}
      aria-keyshortcuts={item.shortcut}
      data-selection-tool={SELECTION_TOOLS.has(item.key) ? "" : undefined}
      aria-haspopup={item.key === "adjust" ? "dialog" : undefined}
      aria-expanded={item.key === "adjust" ? panel : undefined}
      title={item.title}
      className={TOOL}
      onFocus={() => setCurrent(at)}
      onClick={() => {
        if (item.enabled) item.run();
      }}
    >
      {text(item.label)}
    </button>
  );

  const tools = (
    <div
      ref={toolsRow}
      role="toolbar"
      aria-label={text("tree.tools.name")}
      className={TOOLS}
      onKeyDown={onKeyDown}
    >
      {shown.map((item, at) =>
        item.key === "adjust" ? (
          <Popover.Root key={item.key} open={panel} onOpenChange={setPanel}>
            <Popover.Anchor asChild>{button(item, at)}</Popover.Anchor>
            <Popover.Portal>
              <Popover.Content
                align="start"
                sideOffset={4}
                onCloseAutoFocus={(event) => {
                  event.preventDefault();
                  buttons.current[adjustAt]?.focus();
                }}
              >
                <AdjustPanel
                  value={selecting.value}
                  selection={selecting.selection}
                  onApply={(applied) => {
                    setPanel(false);
                    selecting.onApply(applied);
                  }}
                  onCancel={() => setPanel(false)}
                />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : (
          button(item, at)
        ),
      )}
      {crowded ? (
        <MoreMenu
          buttonRef={(node) => {
            buttons.current[shown.length] = node;
          }}
          tabIndex={shown.length === stop ? 0 : -1}
          items={given}
          onFocus={() => setCurrent(shown.length)}
        />
      ) : null}
    </div>
  );
  return (
    <div ref={ref} className={asking?.kind === "group" ? TOOLBAR_GROUP : TOOLBAR}>
      {asking === undefined ? tools : <AskedQuestion key={asking.key} asking={asking} />}
      <div className={STATUS}>
        {count === 0 ? null : (
          <p className={SELECTION_COUNT}>{text("tree.select.count", { count })}</p>
        )}
        <ChangeCount count={changes} />
      </div>
    </div>
  );
};
