import { ToggleGroup as RadixToggleGroup } from "radix-ui";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

type Option = { value: string; label: string };

const optionsOf = (value: unknown): Option[] =>
  Array.isArray(value)
    ? value.filter((o): o is Option => typeof o?.value === "string" && typeof o?.label === "string")
    : [];

// A segmented single pick on Radix Toggle Group (EXPERIENCE.md, Atoms).
const ToggleGroup = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  return (
    <RadixToggleGroup.Root
      type="single"
      value={typeof draft === "string" ? draft : ""}
      onValueChange={(value) => emit({ type: "draft.set", id: item.id, value: value || null })}
      aria-label={text(item.props?.label)}
      className="inline-flex rounded-md border border-input"
    >
      {optionsOf(item.props?.options).map((option) => (
        <RadixToggleGroup.Item
          key={option.value}
          value={option.value}
          className="px-3 py-1 text-control text-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {option.label}
        </RadixToggleGroup.Item>
      ))}
    </RadixToggleGroup.Root>
  );
};

register("ToggleGroup", ToggleGroup);
