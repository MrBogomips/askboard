// One choice on Radix Radio Group (design decision 8, renderer row 6), with manual activation
// (EXPERIENCE.md, Option; F-02): the arrow keys move focus only, and Space, Enter or a click
// selects, which only fills the draft. Radix's roving focus stays as it is; what changes is that
// Radix checks the radio the arrow keys move to by clicking it from its focus handler, and that
// click is cancelled here. It is the only click dispatched in the same task as a focus: a pointer
// click and Space's click come in tasks of their own. Radix leaves Enter unhandled on a radio, so
// Enter selects here.

import { RadioGroup } from "radix-ui";
import { type KeyboardEvent, type MouseEvent, useRef } from "react";
import { questionTextId } from "../port.ts";
import { MARK, OptionText, optionAria, ROW } from "./option-text.tsx";
import type { ChoiceProps } from "./props.ts";

export const SingleChoice = ({ item, value, onValueChange, disabled }: ChoiceProps) => {
  const focusing = useRef(false);
  const onFocus = () => {
    focusing.current = true;
    queueMicrotask(() => {
      focusing.current = false;
    });
  };
  const onClick = (event: MouseEvent) => {
    if (focusing.current) event.preventDefault();
  };
  const onEnter = (label: string) => (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onValueChange([label]);
  };
  return (
    <RadioGroup.Root
      aria-labelledby={questionTextId(item.id)}
      value={value?.[0] ?? ""}
      onValueChange={(label) => onValueChange([label])}
      disabled={disabled}
      className="flex flex-col gap-2"
    >
      {item.props.options.map((option, index) => (
        <RadioGroup.Item
          key={option.label}
          value={option.label}
          {...optionAria(item.id, index, option)}
          onFocus={onFocus}
          onClick={onClick}
          onKeyDown={onEnter(option.label)}
          className={ROW}
        >
          <span className={`${MARK} rounded-full`}>
            <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
          </span>
          <OptionText itemId={item.id} index={index} option={option} />
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
};
