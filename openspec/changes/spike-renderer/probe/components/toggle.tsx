import { Switch } from "radix-ui";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

// On/off on Radix Switch (EXPERIENCE.md, Atoms).
const Toggle = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const id = `${item.id}-switch`;
  return (
    <div className="flex items-center gap-2">
      <Switch.Root
        id={id}
        checked={draft === true}
        onCheckedChange={(checked) => emit({ type: "draft.set", id: item.id, value: checked })}
        className="relative h-5 w-9 rounded-full border border-input bg-muted data-[state=checked]:bg-primary"
      >
        <Switch.Thumb className="block size-4 rounded-full bg-card transition-transform data-[state=checked]:translate-x-4" />
      </Switch.Root>
      <label htmlFor={id} className="text-body text-foreground">
        {text(item.props?.label)}
      </label>
    </div>
  );
};

register("Toggle", Toggle);
