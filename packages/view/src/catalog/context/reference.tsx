// The reference (excerpts, design decision 6; DESIGN.md, Reference; view spec, "References open in
// one click"): a bordered chip on two lines, the kind label (FILE, GITHUB, WEB) and the path or
// title, then the hint, the external-link mark only on a reference that opens in the browser. It is
// a button, so a click or Enter will open it; the open-reference message it sends joins it in task
// 6.5, and the Snapshot look, with no parent host, in task 6.4.

import type { ItemProps } from "../port.ts";
import { useReadyAfterLayout } from "../port.ts";
import { HINT, LABEL, PATH, REFERENCE, REFERENCE_ROW } from "./classes.ts";
import { Marked } from "./marked.tsx";
import { referenceOf } from "./props.ts";

export const Reference = ({ item, ready }: ItemProps<{ readonly props: unknown }>) => {
  useReadyAfterLayout(ready);
  const reference = referenceOf(item.props);
  return (
    <button type="button" data-context="reference" title={reference.target} className={REFERENCE}>
      <span className={REFERENCE_ROW}>
        <span data-context-part="label" className={LABEL}>
          {reference.label}
        </span>
        <bdi data-context-part="path" className={PATH}>
          <Marked text={reference.shown} />
        </bdi>
      </span>
      {reference.external ? (
        <span data-context-part="hint" className={HINT}>
          opens in browser{" "}
          <span data-context-part="external" aria-hidden="true">
            ↗
          </span>
        </span>
      ) : (
        <span data-context-part="hint" className={HINT}>
          opens in a reading panel
        </span>
      )}
    </button>
  );
};
