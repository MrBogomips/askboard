import { Children } from "react";
import { Tabs as RadixTabs } from "radix-ui";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

// Tabs inside a question, on Radix Tabs. The open tab is view state kept in the draft record
// (ACR-11). Every panel stays mounted (`forceMount`, hidden when inactive) so the items of
// inactive tabs still report ready; otherwise the question would never count as visible.
const Tabs = ({ item, ui, emit, ready, children }: ItemProps) => {
  useReadyAfterLayout(ready);
  const labels = Array.isArray(item.props?.tabs) ? (item.props.tabs as unknown[]).map((t) => text(t)) : [];
  const panels = Children.toArray(children);
  const active = typeof ui === "string" ? ui : "0";
  return (
    <RadixTabs.Root
      value={active}
      onValueChange={(value) => emit({ type: "ui.set", id: item.id, value })}
      className="flex flex-col gap-2"
    >
      <RadixTabs.List className="flex gap-1 border-b border-border" aria-label={text(item.props?.label)}>
        {panels.map((_, index) => (
          <RadixTabs.Trigger
            // biome-ignore lint/suspicious/noArrayIndexKey: tabs are positional
            key={index}
            value={String(index)}
            className="px-2 py-1 text-control text-muted-foreground data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground"
          >
            {labels[index] ?? `Tab ${index + 1}`}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {panels.map((panel, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tabs are positional
        <RadixTabs.Content key={index} value={String(index)} forceMount className="data-[state=inactive]:hidden">
          {panel}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
};

register("Tabs", Tabs);
