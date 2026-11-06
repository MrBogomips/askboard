// The check box of the Tree's selection column (spec, "Tree row selection"): a native check box,
// out of the Tab order because the treegrid is one Tab stop and Space selects the focused row, with
// the partial state of a parent whose branch is only partly selected set as the DOM's
// `indeterminate`. A click on it changes the selection and never takes the focus (the grid's
// handler of `mousedown` prevents it, and the focus goes to the row).

import { CHECKBOX } from "./classes.ts";
import type { CheckState } from "./model/selection.ts";

export const SelectBox = ({
  state,
  label,
  node,
}: {
  readonly state: CheckState;
  readonly label: string;
  /** The row's node ID, or `undefined` for the header's check box, which selects every node. */
  readonly node: string | undefined;
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
    className={CHECKBOX}
  />
);
