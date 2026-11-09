// The Ranking's toolbar row (view-and-widgets spec: Ranking at the keyboard; DESIGN.md: Ranking;
// design decision 8), following the Tree's toolbar rules: the tools as `button-secondary`s, one
// Tab stop with the horizontal arrow keys, Home and End among them, skipping disabled tools
// (`toolbarFocus`, `toolbarStop`), then the counter at the row's right. A disabled tool is
// `aria-disabled` rather than `disabled`, so that a tool that turns disabled under the focus, such
// as "Move down" once its row is last, keeps the focus and the next Enter does nothing.

import { keyPressOf, type Say, useStrings } from "@askboard/view/catalog";
import { type KeyboardEvent, useRef, useState } from "react";
import { toolbarFocus, toolbarPressMove, toolbarStop } from "../shared/toolbar-focus.ts";
import { CHANGE_DOT, COUNTER, COUNTER_TEXT, TOOL, TOOLBAR, TOOLS } from "./classes.ts";
import type { RankingTools } from "./keys.ts";
import { counterText } from "./text.ts";

type Tool = {
  readonly key: "moveUp" | "moveDown" | "keep";
  readonly label: "ranking.moveUp" | "ranking.moveDown" | "ranking.keep";
  readonly run: () => void;
};

const toolsOf = (onMove: (delta: -1 | 1) => void, onKeep: () => void): readonly Tool[] => [
  { key: "moveUp", label: "ranking.moveUp", run: () => onMove(-1) },
  { key: "moveDown", label: "ranking.moveDown", run: () => onMove(1) },
  { key: "keep", label: "ranking.keep", run: onKeep },
];

export const RankingToolbar = ({
  tools,
  held,
  moved,
  onMove,
  onKeep,
}: {
  readonly tools: RankingTools;
  /** The Ranking holds an order, for the counter. */
  readonly held: boolean;
  /** How many rows are off the agent's place. */
  readonly moved: number;
  readonly onMove: (delta: -1 | 1) => void;
  readonly onKeep: () => void;
}) => {
  const text = useStrings();
  const say: Say = text;
  const [at, setAt] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const list = toolsOf(onMove, onKeep);
  const enabled = list.map(({ key }) => tools[key]);
  const stop = toolbarStop(enabled, at);
  const words = counterText(held, moved, say);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const move = toolbarPressMove(keyPressOf(event));
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
        {list.map((tool, place) => (
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
              if (enabled[place]) tool.run();
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
