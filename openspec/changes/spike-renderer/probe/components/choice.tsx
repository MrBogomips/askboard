import { Checkbox, RadioGroup } from "radix-ui";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

type Option = { value: string; label: string };

const optionsOf = (value: unknown): Option[] =>
  Array.isArray(value)
    ? value.filter((o): o is Option => typeof o?.value === "string" && typeof o?.label === "string")
    : [];

const box =
  "flex size-4 items-center justify-center border border-input bg-card data-[state=checked]:border-primary";

// Single choice on Radix Radio Group, multiple on Radix Checkbox (EXPERIENCE.md, Atoms).
const Choice = ({ item, draft, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  const options = optionsOf(item.props?.options);
  const label = text(item.props?.label);
  const set = (value: unknown) => emit({ type: "draft.set", id: item.id, value });
  if (item.props?.multiple === true) {
    const chosen = Array.isArray(draft) ? (draft as string[]) : [];
    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="text-label uppercase text-muted-foreground">{label}</legend>
        {options.map((option) => {
          const id = `${item.id}-${option.value}`;
          return (
            <div key={option.value} className="flex items-center gap-2">
              <Checkbox.Root
                id={id}
                className={`${box} rounded-sm`}
                checked={chosen.includes(option.value)}
                onCheckedChange={(checked) =>
                  set(
                    checked === true
                      ? [...chosen, option.value]
                      : chosen.filter((v) => v !== option.value),
                  )
                }
              >
                <Checkbox.Indicator className="size-2 bg-primary" />
              </Checkbox.Root>
              <label htmlFor={id} className="text-body text-foreground">
                {option.label}
              </label>
            </div>
          );
        })}
      </fieldset>
    );
  }
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="text-label uppercase text-muted-foreground">{label}</legend>
      <RadioGroup.Root
        className="flex flex-col gap-1"
        value={typeof draft === "string" ? draft : ""}
        onValueChange={set}
        aria-label={label}
      >
        {options.map((option) => {
          const id = `${item.id}-${option.value}`;
          return (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroup.Item id={id} value={option.value} className={`${box} rounded-full`}>
                <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
              </RadioGroup.Item>
              <label htmlFor={id} className="text-body text-foreground">
                {option.label}
              </label>
            </div>
          );
        })}
      </RadioGroup.Root>
    </fieldset>
  );
};

register("Choice", Choice);
