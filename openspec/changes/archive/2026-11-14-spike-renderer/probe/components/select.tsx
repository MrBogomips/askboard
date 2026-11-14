import { Select as RadixSelect } from "radix-ui";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { shimStyleElements } from "./_style-shim.ts";
import { Field, inputClass, text } from "./_field.tsx";

type Option = { value: string; label: string };

const optionsOf = (value: unknown): Option[] =>
  Array.isArray(value)
    ? value.filter((o): o is Option => typeof o?.value === "string" && typeof o?.label === "string")
    : [];

// A single pick from a long list on Radix Select (EXPERIENCE.md, Atoms). `position` is a probe
// prop: Radix's default `item-aligned` locks the page's scroll while open, `popper` does not.
// `props.styleShim`: the style-element shim, as for S-6 (Select locks scroll while open).
const Select = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  if (item.props?.styleShim === true) shimStyleElements();
  const id = `${item.id}-trigger`;
  const position = item.props?.position === "popper" ? "popper" : "item-aligned";
  return (
    <Field id={id} label={text(item.props?.label)}>
      <RadixSelect.Root
        value={typeof draft === "string" ? draft : undefined}
        onValueChange={(value) => emit({ type: "draft.set", id: item.id, value })}
      >
        <RadixSelect.Trigger id={id} className={`${inputClass} flex items-center justify-between`}>
          <RadixSelect.Value placeholder={text(item.props?.placeholder, "Choose")} />
          <RadixSelect.Icon className="text-muted-foreground">▾</RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content
            position={position}
            className="rounded-md border border-border bg-popover text-popover-foreground shadow-md"
          >
            <RadixSelect.Viewport className="p-1">
              {optionsOf(item.props?.options).map((option) => (
                <RadixSelect.Item
                  key={option.value}
                  value={option.value}
                  className="rounded-sm px-2 py-1 text-body data-[highlighted]:bg-accent data-[highlighted]:outline-none"
                >
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
    </Field>
  );
};

register("Select", Select);
