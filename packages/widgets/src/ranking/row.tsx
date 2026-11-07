// One row of the Ranking (view-and-widgets spec: Ranking reorder; DESIGN.md: Ranking): a grip
// handle, the position number, the label and the description. The row is draggable by its handle
// and a drop target while the Ranking can change; it is one option of the list, the current one
// holding the list's Tab stop. A moved row's position number takes the change highlight. The label
// and description are the agent's content, shown as text (AD-8).

import type { RankingElement } from "@askboard/contract";
import { useStrings } from "@askboard/view/catalog";
import { type RefObject, useRef } from "react";
import {
  DESCRIPTION,
  DRAGGED_ROW,
  DROP_AFTER,
  DROP_BEFORE,
  HANDLE,
  LABEL,
  POSITION,
  POSITION_MOVED,
  ROW,
  TEXT,
} from "./classes.ts";
import { type RowDragEvents, useRowDrag } from "./drag.ts";
import type { Indicator } from "./drop.ts";

const GRIP_DOTS = "M4 2.5h.01M8 2.5h.01M4 6h.01M8 6h.01M4 9.5h.01M8 9.5h.01";

// The drag handle: a grip of six dots, named "Drag <name>". It is no tab stop and no button: the
// row stays the one focusable thing.
const Handle = ({
  handle,
  name,
}: {
  readonly handle: RefObject<HTMLSpanElement | null>;
  readonly name: string;
}) => {
  const text = useStrings();
  return (
    <span
      ref={handle}
      role="img"
      aria-label={text("ranking.handle", { name })}
      data-drag-handle=""
      data-grab=""
      className={HANDLE}
    >
      <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
        <path
          d={GRIP_DOTS}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
};

const lineOf = (indicator: Indicator | undefined): string =>
  indicator === "before" ? DROP_BEFORE : indicator === "after" ? DROP_AFTER : "";

export const RankingRow = ({
  rankingId,
  element,
  position,
  current,
  moved,
  dragged,
  indicator,
  editable,
  events,
  rowRef,
  onFocus,
}: {
  readonly rankingId: string;
  readonly element: RankingElement;
  /** Its place in the order, from 1. */
  readonly position: number;
  /** The list's current row, holding its Tab stop. */
  readonly current: boolean;
  /** Not where the agent put it. */
  readonly moved: boolean;
  /** Being dragged. */
  readonly dragged: boolean;
  /** The drop line it shows, while a drag is over it. */
  readonly indicator: Indicator | undefined;
  /** The Ranking can change: the row drags and takes drops. */
  readonly editable: boolean;
  readonly events: RefObject<RowDragEvents>;
  /** Hands the row's element to the list, for its focus. */
  readonly rowRef: (node: HTMLDivElement | null) => void;
  /** The row took the focus or a press: it is the current one. */
  readonly onFocus: () => void;
}) => {
  const row = useRef<HTMLDivElement | null>(null);
  const handle = useRef<HTMLSpanElement | null>(null);
  useRowDrag({ row, handle, rankingId, itemId: element.id, enabled: editable, events });
  const classes = [ROW, dragged ? DRAGGED_ROW : "", lineOf(indicator)].filter(Boolean).join(" ");
  return (
    <div
      ref={(node) => {
        row.current = node;
        rowRef(node);
      }}
      role="option"
      aria-selected={current}
      aria-current={current ? "true" : undefined}
      tabIndex={current ? 0 : -1}
      data-ranking-row={element.id}
      data-change={moved ? "moved" : undefined}
      data-drop={indicator}
      data-dragging={dragged ? "" : undefined}
      className={classes}
      onFocus={onFocus}
      onMouseDown={onFocus}
    >
      {editable ? <Handle handle={handle} name={element.label} /> : null}
      <span data-position="" className={moved ? POSITION_MOVED : POSITION}>
        {position}
      </span>
      <span className={TEXT}>
        <span className={LABEL}>{element.label}</span>
        {element.description === undefined ? null : (
          <span className={DESCRIPTION}>{element.description}</span>
        )}
      </span>
    </div>
  );
};
