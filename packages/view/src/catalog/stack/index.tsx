// The Stack layout's chunk (layouts, design decision 7; view-and-widgets spec: Stack and Group): its
// items one under another in a column, `{spacing.md}` between them. It adds nothing else: no frame,
// no title. Each item draws through the port's renderer (AD-9). It reports itself ready once it
// has been laid out.

import { itemsOf, rendererOf } from "../layouts/layout.ts";
import { type ItemProps, register, useReadyAfterLayout } from "../port.ts";

/** The catalog name, which is the Stack item's type. */
const STACK = "stack";

type UncheckedStackItem = {
  readonly type: "stack";
  readonly id: string;
  readonly props: unknown;
};

const Stack = ({ item, ready, renderItem }: ItemProps<UncheckedStackItem>) => {
  const items = itemsOf("Stack", item.id, item.props);
  const render = rendererOf("Stack", item.id, renderItem);
  useReadyAfterLayout(ready);
  return <div className="flex min-w-0 flex-col gap-md">{items.map((child) => render(child))}</div>;
};

register(STACK, Stack);
