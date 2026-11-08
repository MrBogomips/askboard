// The Row layout's chunk (layouts, design decision 7; view-and-widgets spec: Row): its items side by
// side, each taking its weight's share of the Row's width, while every item gets at least
// 240 px; otherwise one under another, in order. A `ResizeObserver` on the Row's own
// box decides, so the Row answers to the width the card gives it and not to the window's. A weight
// reaches the view as one of four fixed classes, written out in full for Tailwind, never as a
// `style` attribute (AD-8). It reports itself ready after its first measure (AD-9).

import { useLayoutEffect, useRef, useState } from "react";
import { itemsOf, rendererOf } from "../layouts/layout.ts";
import { type ItemProps, register, useReadyAfterLayout } from "../port.ts";
import { weightsOf, widthNeeded } from "./width.ts";

/** The catalog name, which is the Row item's type. */
const ROW = "row";

type UncheckedRowItem = {
  readonly type: "row";
  readonly id: string;
  readonly props: unknown;
};

// One class set per weight; each class is written out in full so that Tailwind finds it.
const SIDE_BY_SIDE: Readonly<Record<number, string>> = {
  1: "min-w-0 grow basis-0",
  2: "min-w-0 grow-2 basis-0",
  3: "min-w-0 grow-3 basis-0",
  4: "min-w-0 grow-4 basis-0",
};
const IN_A_COLUMN = "min-w-0";
const WIDE = "flex min-w-0 flex-row gap-md";
const NARROW = "flex min-w-0 flex-col gap-md";

const Row = ({ item, ready, renderItem }: ItemProps<UncheckedRowItem>) => {
  const items = itemsOf("Row", item.id, item.props);
  const render = rendererOf("Row", item.id, renderItem);
  const weights = weightsOf(
    item.id,
    item.props,
    items.map(({ id }) => id),
  );
  const needed = widthNeeded(weights);
  const box = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState<boolean | undefined>(undefined);
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) return undefined;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? element.getBoundingClientRect().width;
      setWide(width >= needed);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [needed]);
  useReadyAfterLayout(ready, wide !== undefined);
  return (
    <div
      ref={box}
      data-askboard-row={wide === true ? "side-by-side" : "column"}
      className={wide === true ? WIDE : NARROW}
    >
      {items.map((child, at) => (
        <div
          key={child.id}
          className={wide === true ? SIDE_BY_SIDE[weights[at] ?? 1] : IN_A_COLUMN}
        >
          {render(child)}
        </div>
      ))}
    </div>
  );
};

register(ROW, Row);
