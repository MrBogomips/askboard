import { Popover as RadixPopover } from "radix-ui";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { shimStyleElements } from "./_style-shim.ts";
import { text } from "./_field.tsx";

// A detail behind a trigger on Radix Popover (EXPERIENCE.md, Atoms). Whether it is open is view
// state in the draft record. `modal` is a probe prop: a modal popover locks scroll like Dialog.
const Popover = ({ item, ui, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  if (item.props?.styleShim === true) shimStyleElements();
  return (
    <RadixPopover.Root
      open={ui === true}
      onOpenChange={(open) => emit({ type: "ui.set", id: item.id, value: open })}
      modal={item.props?.modal === true}
    >
      <RadixPopover.Trigger className="rounded-md border border-input bg-card px-2 py-1 text-control">
        {text(item.props?.label, "Details")}
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          sideOffset={4}
          className="max-w-xs rounded-md border border-border bg-popover p-3 text-body text-popover-foreground shadow-md"
        >
          {text(item.props?.text)}
          <RadixPopover.Close className="ml-2 text-muted-foreground" aria-label="Close">
            ✕
          </RadixPopover.Close>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
};

register("Popover", Popover);
