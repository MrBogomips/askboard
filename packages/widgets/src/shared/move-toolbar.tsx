// The toolbar row the Kanban and the Timeline share (view-and-widgets spec: Kanban at the keyboard,
// Timeline at the keyboard; DESIGN.md: Kanban, Timeline), following the Tree's and the Ranking's
// toolbar rules: the tools as `button-secondary`s, one Tab stop with the horizontal arrow keys, Home
// and End among them, skipping disabled tools (`toolbarFocus`, `toolbarStop`), then the counter at
// the row's right. A tool is a button or the trigger of a menu of options ("Move to…"). A disabled
// tool is `aria-disabled` rather than `disabled`, so that a tool that turns disabled under the
// focus keeps it and the next Enter does nothing; a disabled menu never opens. The menus are not
// modal, as the Tree's "More" menu, so they lock no scroll and add no style element.

import { DropdownMenu } from "radix-ui";
import { type KeyboardEvent, useRef, useState } from "react";
import {
  CHANGE_DOT,
  COUNTER,
  COUNTER_TEXT,
  MENU,
  MENU_ITEM,
  TOOL,
  TOOLBAR,
  TOOLS,
} from "./move-classes.ts";
import { toolbarFocus, toolbarMoveOf, toolbarStop } from "./toolbar-focus.ts";

/** One tool of the row: a button that runs, or a menu whose options call `onChoose`. */
export type MoveTool = {
  readonly key: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly run?: () => void;
  readonly menu?: {
    readonly options: readonly { readonly id: string; readonly label: string }[];
    readonly onChoose: (id: string) => void;
  };
};

type StopProps = {
  readonly tool: MoveTool;
  readonly tabIndex: 0 | -1;
  readonly buttonRef: (node: HTMLButtonElement | null) => void;
  readonly onFocus: () => void;
};

const ButtonTool = ({ tool, tabIndex, buttonRef, onFocus }: StopProps) => (
  <button
    ref={buttonRef}
    type="button"
    tabIndex={tabIndex}
    aria-disabled={tool.enabled ? undefined : true}
    className={TOOL}
    onFocus={onFocus}
    onClick={() => {
      if (tool.enabled) tool.run?.();
    }}
  >
    {tool.label}
  </button>
);

const MenuTool = ({ tool, tabIndex, buttonRef, onFocus }: StopProps) => {
  const [open, setOpen] = useState(false);
  const menu = tool.menu;
  return (
    <DropdownMenu.Root
      modal={false}
      open={open && tool.enabled}
      onOpenChange={(next) => setOpen(next && tool.enabled)}
    >
      <DropdownMenu.Trigger asChild>
        <button
          ref={buttonRef}
          type="button"
          tabIndex={tabIndex}
          aria-disabled={tool.enabled ? undefined : true}
          className={TOOL}
          onFocus={onFocus}
        >
          {tool.label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={4} className={MENU}>
          {(menu?.options ?? []).map((option) => (
            <DropdownMenu.Item
              key={option.id}
              className={MENU_ITEM}
              data-menu-option={option.id}
              onSelect={() => menu?.onChoose(option.id)}
            >
              {option.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

export const MoveToolbar = ({
  widget,
  name,
  tools,
  counter,
  changed,
}: {
  /** The widget's name, in the data attributes the toolbar and its counter carry. */
  readonly widget: "kanban" | "timeline";
  /** The toolbar's accessible name. */
  readonly name: string;
  readonly tools: readonly MoveTool[];
  /** The counter's text. */
  readonly counter: string;
  /** Something moved: the counter takes the change dot. */
  readonly changed: boolean;
}) => {
  const [at, setAt] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = tools.map((tool) => tool.enabled);
  const stop = toolbarStop(enabled, at);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    // A menu is portaled out of the toolbar but its keys bubble here: they are the menu's.
    if (!event.currentTarget.contains(event.target as Node)) return;
    const move = toolbarMoveOf(event.key);
    if (move === undefined) return;
    event.preventDefault();
    buttons.current[toolbarFocus(enabled, at, move)]?.focus();
  };

  return (
    <div className={TOOLBAR} {...{ [`data-${widget}-toolbar`]: "" }}>
      <div role="toolbar" aria-label={name} className={TOOLS} onKeyDown={onKeyDown}>
        {tools.map((tool, place) => {
          const props: StopProps = {
            tool,
            tabIndex: place === stop ? 0 : -1,
            buttonRef: (node) => {
              buttons.current[place] = node;
            },
            onFocus: () => setAt(place),
          };
          return tool.menu === undefined ? (
            <ButtonTool key={tool.key} {...props} />
          ) : (
            <MenuTool key={tool.key} {...props} />
          );
        })}
      </div>
      <p className={COUNTER} title={counter} {...{ [`data-${widget}-counter`]: "" }}>
        {changed ? <span aria-hidden="true" className={CHANGE_DOT} /> : null}
        <span className={COUNTER_TEXT}>{counter}</span>
      </p>
    </div>
  );
};
