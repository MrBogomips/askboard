// The Choice atom's chunk (design decision 8): Radix Radio Group for one choice, Checkbox for
// several, never Select (renderer row 6). Option labels and descriptions are agent text, rendered
// as text only (AD-8). Task 8.5 completes it: manual activation, the question card and its header.

import { Checkbox, RadioGroup } from "radix-ui";
import { CHOICE } from "../components.ts";
import { type ItemProps, register } from "../port.ts";

const optionId = (itemId: string, index: number) => `${itemId}-option-${index}`;

const OPTION = "flex items-start gap-2 rounded-md p-2 text-body text-foreground";
const CONTROL =
  "mt-0.5 flex size-4 shrink-0 items-center justify-center border border-input bg-card " +
  "focus-visible:outline-2 focus-visible:outline-ring data-[state=checked]:border-primary";

const Label = ({ id, label, description }: { id: string; label: string; description?: string }) => (
  <label htmlFor={id} className="flex flex-col gap-0.5">
    <span>{label}</span>
    {description === undefined ? null : (
      <span className="text-muted-foreground">{description}</span>
    )}
  </label>
);

const Choice = ({ item, value, onValueChange }: ItemProps) => {
  const { options, multiSelect, text } = item.props;
  if (multiSelect === true) {
    const toggle = (label: string, checked: boolean) =>
      onValueChange(checked ? [...value, label] : value.filter((chosen) => chosen !== label));
    return (
      <fieldset className="flex flex-col gap-1">
        <legend className="sr-only">{text}</legend>
        {options.map((option, index) => (
          <div key={option.label} className={OPTION}>
            <Checkbox.Root
              id={optionId(item.id, index)}
              className={`${CONTROL} rounded-md`}
              checked={value.includes(option.label)}
              onCheckedChange={(checked) => toggle(option.label, checked === true)}
            >
              <Checkbox.Indicator className="size-2 bg-primary" />
            </Checkbox.Root>
            <Label id={optionId(item.id, index)} {...option} />
          </div>
        ))}
      </fieldset>
    );
  }
  return (
    <RadioGroup.Root
      className="flex flex-col gap-1"
      aria-label={text}
      value={value[0] ?? ""}
      onValueChange={(label) => onValueChange([label])}
    >
      {options.map((option, index) => (
        <div key={option.label} className={OPTION}>
          <RadioGroup.Item
            id={optionId(item.id, index)}
            value={option.label}
            className={`${CONTROL} rounded-full`}
          >
            <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
          </RadioGroup.Item>
          <Label id={optionId(item.id, index)} {...option} />
        </div>
      ))}
    </RadioGroup.Root>
  );
};

register(CHOICE, Choice);
