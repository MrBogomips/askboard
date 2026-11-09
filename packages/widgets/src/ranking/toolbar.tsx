// The Ranking's toolbar row (view-and-widgets spec: Ranking at the keyboard, Keyboard shortcuts are
// discoverable; DESIGN.md: Ranking; design decisions 5 and 8), following the Tree's toolbar rules:
// the tools as `button-secondary`s, each in a `KeyHint` that shows its name and keys, one Tab stop
// with the horizontal arrow keys, Home and End among them (the keys in effect, skipping disabled
// tools: `toolbarFocus`, `toolbarStop`), then "More" when the row is crowded, then the Keys button,
// the last stop and never in "More". At the row's right: "N selected" while rows are selected, then
// the counter. A disabled tool is `aria-disabled` rather than `disabled`, so that a tool that turns
// disabled under the focus, such as "Move down" once its row is last, keeps the focus and the next
// Enter does nothing. "To top", "To bottom" and "Select none" go into the "More" menu when the row
// cannot hold all the tools and the counter's minimum (`shared/crowded.ts`).

import { ariaKeyShortcuts, type KeyEntry } from "@askboard/contract";
import {
  KeyHint,
  KeysButton,
  keyPressOf,
  MenuKeys,
  type Say,
  useKeysPanel,
  useLanguage,
  useStrings,
} from "@askboard/view/catalog";
import { DropdownMenu } from "radix-ui";
import { type KeyboardEvent, type RefObject, useRef, useState } from "react";
import { toolbarFocus, toolbarStop } from "../shared/toolbar-focus.ts";
import { useCrowded } from "../shared/use-crowded.ts";
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
  TOOLS,
} from "./classes.ts";
import { entryOf, type RankingTool, type RankingTools, toolbarLayout } from "./keys.ts";
import { toolbarMoveOfPress } from "./list-keys.ts";
import { counterText } from "./text.ts";

/** A tool of the toolbar, by its place in `RankingTools`. */
export type ToolKey = keyof RankingTools;

// The "More" menu, the last tool stop but the Keys button's: the tools given up when crowded, each
// disabled as its tool is, showing its keys in effect as key caps at its end (`MenuKeys`) and
// carrying them for assistive technology. It is not modal, as the Tree's, so it locks no scroll and
// adds no style element.
const MoreMenu = ({
  buttonRef,
  tabIndex,
  given,
  tools,
  table,
  onFocus,
  onTool,
}: {
  readonly buttonRef: (button: HTMLButtonElement | null) => void;
  readonly tabIndex: 0 | -1;
  readonly given: readonly RankingTool[];
  readonly tools: RankingTools;
  readonly table: readonly KeyEntry[];
  readonly onFocus: () => void;
  readonly onTool: (tool: ToolKey) => void;
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
          {given.map((tool) => {
            const keys = table.find(
              (entry) => entry.action === tool.action && entry.part === "list",
            );
            const aria = keys === undefined ? "" : ariaKeyShortcuts(keys.keys);
            const entry = entryOf(tool.action);
            return (
              <DropdownMenu.Item
                key={tool.key}
                className={MENU_ITEM}
                disabled={!tools[tool.key]}
                aria-keyshortcuts={aria === "" ? undefined : aria}
                onSelect={() => onTool(tool.key)}
              >
                {text(tool.label)}
                {entry === undefined ? null : <MenuKeys entry={entry} />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

/** The focus props of one stop of the toolbar: its ref, its Tab stop and its focus. */
type Stop = {
  readonly ref: (node: HTMLButtonElement | null) => void;
  readonly tabIndex: 0 | -1;
  readonly onFocus: () => void;
};

// One tool, a button in a `KeyHint` that names its action and its keys in effect.
const Tool = ({
  tool,
  enabled,
  stop,
  onTool,
}: {
  readonly tool: RankingTool;
  readonly enabled: boolean;
  readonly stop: Stop;
  readonly onTool: (tool: ToolKey) => void;
}) => {
  const text = useStrings();
  const entry = entryOf(tool.action);
  const button = (
    <button
      type="button"
      {...stop}
      aria-disabled={enabled ? undefined : true}
      className={TOOL}
      onClick={() => {
        if (enabled) onTool(tool.key);
      }}
    >
      {text(tool.label)}
    </button>
  );
  return entry === undefined ? button : <KeyHint entry={entry}>{button}</KeyHint>;
};

/**
 * The row, drawn for a given `crowded`: the measure is the wrapper's (`RankingToolbar`), so that a
 * test draws either row. `toolsRef` is the tools' element, which the wrapper measures.
 */
export const ToolbarRow = ({
  tools,
  table,
  held,
  moved,
  selected,
  crowded,
  toolsRef,
  onTool,
}: {
  readonly tools: RankingTools;
  /** The keys in effect, for the keys that move the focus among the tools and the menu's. */
  readonly table: readonly KeyEntry[];
  /** The Ranking holds an order, for the counter. */
  readonly held: boolean;
  /** How many rows are off the agent's place. */
  readonly moved: number;
  /** How many rows are selected. */
  readonly selected: number;
  /** The row cannot hold every tool and the counter's minimum. */
  readonly crowded: boolean;
  readonly toolsRef: RefObject<HTMLDivElement | null>;
  /** An enabled tool was chosen. */
  readonly onTool: (tool: ToolKey) => void;
}) => {
  const text = useStrings();
  const say: Say = text;
  const [at, setAt] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const hasKeys = useKeysPanel() !== undefined;
  const { shown, given, moreAt, keysAt } = toolbarLayout(crowded, hasKeys);
  // Each stop's enabled state: the shown tools', "More", then the Keys button, which are always on.
  const stops = [
    ...shown.map(({ key }) => tools[key]),
    ...(moreAt === undefined ? [] : [true]),
    ...(hasKeys ? [true] : []),
  ];
  const stop = toolbarStop(stops, at);
  const words = counterText(held, moved, say);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // The "More" menu is portaled out of the toolbar but its keys bubble here: they are the menu's.
    if (!event.currentTarget.contains(event.target as Node)) return;
    const move = toolbarMoveOfPress(table, keyPressOf(event));
    if (move === undefined) return;
    event.preventDefault();
    buttons.current[toolbarFocus(stops, at, move)]?.focus();
  };

  const stopProps = (place: number): Stop => ({
    ref: (node) => {
      buttons.current[place] = node;
    },
    tabIndex: place === stop ? 0 : -1,
    onFocus: () => setAt(place),
  });

  return (
    <div className={TOOLBAR} data-ranking-toolbar="">
      <div
        ref={toolsRef}
        role="toolbar"
        aria-label={text("ranking.tools")}
        className={TOOLS}
        onKeyDown={onKeyDown}
      >
        {shown.map((tool, place) => (
          <Tool
            key={tool.key}
            tool={tool}
            enabled={tools[tool.key]}
            stop={stopProps(place)}
            onTool={onTool}
          />
        ))}
        {moreAt !== undefined ? (
          <MoreMenu
            buttonRef={stopProps(moreAt).ref}
            tabIndex={stopProps(moreAt).tabIndex}
            given={given}
            tools={tools}
            table={table}
            onFocus={() => setAt(moreAt)}
            onTool={onTool}
          />
        ) : null}
        <KeysButton {...stopProps(keysAt)} className={TOOL} />
      </div>
      <div className={STATUS}>
        {selected === 0 ? null : (
          <p className={SELECTION_COUNT} data-ranking-selected="">
            {text("ranking.selected", { count: selected })}
          </p>
        )}
        <p className={COUNTER} title={words} data-ranking-counter="">
          {moved > 0 ? <span aria-hidden="true" className={CHANGE_DOT} /> : null}
          <span className={COUNTER_TEXT}>{words}</span>
        </p>
      </div>
    </div>
  );
};

export const RankingToolbar = ({
  tools,
  table,
  held,
  moved,
  selected,
  onTool,
}: {
  readonly tools: RankingTools;
  readonly table: readonly KeyEntry[];
  readonly held: boolean;
  readonly moved: number;
  readonly selected: number;
  readonly onTool: (tool: ToolKey) => void;
}) => {
  const toolsRef = useRef<HTMLDivElement>(null);
  const crowded = useCrowded(toolsRef, useLanguage(), true);
  return (
    <ToolbarRow
      tools={tools}
      table={table}
      held={held}
      moved={moved}
      selected={selected}
      crowded={crowded}
      toolsRef={toolsRef}
      onTool={onTool}
    />
  );
};
