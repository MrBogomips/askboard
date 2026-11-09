// The Ranking's toolbar row (view-and-widgets spec: Ranking at the keyboard; DESIGN.md: Ranking;
// design decision 8), following the Tree's toolbar rules: the tools as `button-secondary`s, one
// Tab stop with the horizontal arrow keys, Home and End among them, skipping disabled tools
// (`toolbarFocus`, `toolbarStop`), then the counter at the row's right. A disabled tool is
// `aria-disabled` rather than `disabled`, so that a tool that turns disabled under the focus, such
// as "Move down" once its row is last, keeps the focus and the next Enter does nothing.

import type { KeyEntry } from "@askboard/contract";
import { keyPressOf, type Say, useStrings } from "@askboard/view/catalog";
import { type KeyboardEvent, useRef, useState } from "react";
import { toolbarFocus, toolbarStop } from "../shared/toolbar-focus.ts";
import { CHANGE_DOT, COUNTER, COUNTER_TEXT, TOOL, TOOLBAR, TOOLS } from "./classes.ts";
import { RANKING_TOOLS, type RankingTools } from "./keys.ts";
import { toolbarMoveOfPress } from "./list-keys.ts";
import { counterText } from "./text.ts";

/** A tool of the toolbar, by its place in `RankingTools`. */
export type ToolKey = keyof RankingTools;

export const RankingToolbar = ({
  tools,
  table,
  held,
  moved,
  onTool,
}: {
  readonly tools: RankingTools;
  /** The keys in effect, for the keys that move the focus among the tools. */
  readonly table: readonly KeyEntry[];
  /** The Ranking holds an order, for the counter. */
  readonly held: boolean;
  /** How many rows are off the agent's place. */
  readonly moved: number;
  /** An enabled tool was chosen. */
  readonly onTool: (tool: ToolKey) => void;
}) => {
  const text = useStrings();
  const say: Say = text;
  const [at, setAt] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const enabled = RANKING_TOOLS.map(({ key }) => tools[key]);
  const stop = toolbarStop(enabled, at);
  const words = counterText(held, moved, say);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const move = toolbarMoveOfPress(table, keyPressOf(event));
    if (move === undefined) return;
    event.preventDefault();
    buttons.current[toolbarFocus(enabled, at, move)]?.focus();
  };

  return (
    <div className={TOOLBAR} data-ranking-toolbar="">
      <div
        role="toolbar"
        aria-label={text("ranking.tools")}
        className={TOOLS}
        onKeyDown={onKeyDown}
      >
        {RANKING_TOOLS.map((tool, place) => (
          <button
            key={tool.key}
            ref={(node) => {
              buttons.current[place] = node;
            }}
            type="button"
            tabIndex={place === stop ? 0 : -1}
            aria-disabled={enabled[place] ? undefined : true}
            className={TOOL}
            onFocus={() => setAt(place)}
            onClick={() => {
              if (enabled[place]) onTool(tool.key);
            }}
          >
            {text(tool.label)}
          </button>
        ))}
      </div>
      <p className={COUNTER} title={words} data-ranking-counter="">
        {moved > 0 ? <span aria-hidden="true" className={CHANGE_DOT} /> : null}
        <span className={COUNTER_TEXT}>{words}</span>
      </p>
    </div>
  );
};
