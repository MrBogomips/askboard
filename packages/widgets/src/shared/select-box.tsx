// The check box of a selection column (the Tree's, spec "Tree row selection", moved here for the
// Ranking's, spec "Ranking row selection"): a native check box, out of the Tab order because its
// widget is one Tab stop and Space selects the current row, with the partial state of a Tree parent
// whose branch is only partly selected set as the DOM's `indeterminate`. A click on it changes the
// selection and never takes the focus (the widget's handler of `mousedown` prevents it, and the
// focus goes to the row). The Tree reads its clicks through `data-select`; the Ranking passes
// `onClick`, which reads the Shift key for a range.

import type { MouseEventHandler } from "react";

/** A row's check box: all of its branch selected, some of it, or none. */
export type CheckState = "checked" | "partial" | "none";

/** The check box's classes: the Tree's, with the focus ring. */
export const CHECKBOX =
  "size-[14px] cursor-pointer align-middle accent-primary focus-visible:outline-2 " +
  "focus-visible:outline-offset-1 focus-visible:outline-ring";

export const SelectBox = ({
  state,
  label,
  node,
  onClick,
  onMouseDown,
}: {
  readonly state: CheckState;
  readonly label: string;
  /** The row's node ID, or `undefined` for the header's check box, which selects every node. */
  readonly node: string | undefined;
  /** A click, with the Shift key it was made with. */
  readonly onClick?: MouseEventHandler<HTMLInputElement>;
  /** A press, which a widget prevents so that the box takes no focus. */
  readonly onMouseDown?: MouseEventHandler<HTMLInputElement>;
}) => (
  <input
    type="checkbox"
    tabIndex={-1}
    data-interactive=""
    data-select={node}
    data-select-all={node === undefined ? "" : undefined}
    aria-label={label}
    checked={state === "checked"}
    ref={(box) => {
      if (box !== null) box.indeterminate = state === "partial";
    }}
    onChange={() => undefined}
    onClick={onClick}
    onMouseDown={onMouseDown}
    className={CHECKBOX}
  />
);
