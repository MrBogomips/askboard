import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

// A derived value: from the compute graph when the item names a node, else its own prop.
const Value = ({ item, graph, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const node = text(item.props?.node);
  const raw = node ? graph[node] : item.props?.value;
  const shown =
    typeof raw === "number" ? new Intl.NumberFormat("en-US").format(raw) : text(raw, "—");
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-label uppercase text-muted-foreground">{text(item.props?.label)}</span>
      <output className="text-body font-medium text-foreground">{shown}</output>
    </div>
  );
};

register("Value", Value);
