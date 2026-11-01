// Several choices on Radix Checkbox (design decision 8, renderer row 6). The boxes are one Tab
// stop, with the arrow keys moving focus among them and never checking one (EXPERIENCE.md, Tab
// order and Option); Space, Enter or a click checks or unchecks, which only fills the draft.
// Radix leaves Enter unhandled on a checkbox, so Enter toggles here.

import { Checkbox } from "radix-ui";
import { type KeyboardEvent, useRef, useState } from "react";
import { questionTextId } from "../port.ts";
import { MARK, OptionText, optionAria, ROW } from "./option-text.tsx";
import type { ChoiceProps } from "./props.ts";
import { nextFocus, toggled } from "./selection.ts";

export const MultipleChoice = ({ item, value, onValueChange, disabled }: ChoiceProps) => {
  const { options } = item.props;
  // Which box is the Tab stop: where focus is, not what is chosen.
  const [stop, setStop] = useState(0);
  const boxes = useRef<(HTMLButtonElement | null)[]>([]);
  const toggle = (label: string, checked: boolean) =>
    onValueChange(toggled(options, value, label, checked));
  const onKeyDown = (index: number, label: string) => (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      toggle(label, value?.includes(label) !== true);
      return;
    }
    const next = nextFocus(event.key, index, options.length);
    if (next === undefined) return;
    event.preventDefault();
    boxes.current[next]?.focus();
  };
  return (
    <fieldset aria-labelledby={questionTextId(item.id)} className="flex flex-col gap-2">
      {options.map((option, index) => (
        <Checkbox.Root
          key={option.label}
          ref={(box) => {
            boxes.current[index] = box;
          }}
          checked={value?.includes(option.label) === true}
          onCheckedChange={(checked) => toggle(option.label, checked === true)}
          disabled={disabled}
          tabIndex={index === stop ? 0 : -1}
          onFocus={() => setStop(index)}
          onKeyDown={onKeyDown(index, option.label)}
          {...optionAria(item.id, index, option)}
          className={ROW}
        >
          <span className={`${MARK} rounded-md`}>
            <Checkbox.Indicator className="size-2 bg-primary" />
          </span>
          <OptionText itemId={item.id} index={index} option={option} />
        </Checkbox.Root>
      ))}
    </fieldset>
  );
};
