import { Children } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";

// Relative widths go through React's `style` prop, which sets them through the CSSOM: a
// hash-only `style-src` blocks `style` attributes in markup, not CSSOM writes.
const Row = ({ item, ready, children }: ItemProps) => {
  useReadyAfterLayout(ready);
  const widths = Array.isArray(item.props?.widths) ? (item.props.widths as unknown[]) : [];
  return (
    <div className="flex flex-row gap-3">
      {Children.toArray(children).map((child, index) => (
        <div
          key={(child as { key?: string }).key ?? index}
          className="min-w-0 basis-0"
          style={{ flexGrow: typeof widths[index] === "number" ? (widths[index] as number) : 1 }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

register("Row", Row);
