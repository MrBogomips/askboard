// The LaTeX's chunk (design decision 7): it registers `latex` through the `CatalogRenderer` port,
// the one part of `view` a widget imports (AD-1, AD-9). The view hands a LaTeX's props over as data,
// unchecked, so the LaTeX checks them as an agent's with the contract's plain check and throws on a
// problem: the item's error boundary then fails it and its question never counts as visible
// (AD-10). It shows its draft value's expression, else the agent's; an edit puts the whole edited
// props into the draft, and an edit back to the agent's expression clears the item's value. The
// preview is drawn by KaTeX as data, bounded (AD-8); a draw that throws fails the item.

import { LATEX_SHAPE, type LatexProps } from "@askboard/contract";
import { type ItemProps, register } from "@askboard/view/catalog";
import { useCallback, useMemo, useState } from "react";
import { checkedLatexProps } from "./checks.ts";
import { valueFor } from "./model.ts";
import { LatexWidget } from "./widget.tsx";

/** The catalog name, which is the LaTeX item's type. */
const LATEX = "latex";

/** A LaTeX item as the view hands it over, its props not checked yet. */
type UncheckedLatexItem = {
  readonly type: "latex";
  readonly id: string;
  readonly props: unknown;
};

const Latex = ({
  item,
  value,
  onValueChange,
  disabled,
  ready,
}: ItemProps<UncheckedLatexItem, LatexProps>) => {
  const sent = useMemo(() => checkedLatexProps(item.id, item.props), [item.id, item.props]);
  // A draw that throws puts its error into the state, and the render throws it: the item's
  // error boundary fails it (AD-9, AD-10).
  const [failure, setFailure] = useState<{ readonly error: Error } | undefined>(undefined);
  const onFail = useCallback((error: unknown) => {
    setFailure({ error: error instanceof Error ? error : new Error(String(error)) });
  }, []);
  if (failure !== undefined) throw failure.error;
  const expression = typeof value?.expression === "string" ? value.expression : sent.expression;
  return (
    <LatexWidget
      expression={expression}
      edited={expression !== sent.expression}
      disabled={disabled}
      ready={ready}
      onText={(text) => onValueChange(valueFor(sent, text))}
      onFail={onFail}
    />
  );
};

// The facts the shell needs of the LaTeX (widget-registry, design decision 8): the shape of its
// one field, for the agent's change, and its name in the notice.
register(LATEX, Latex, {
  shape: () => LATEX_SHAPE,
  name: "change.widgetLatex",
});
