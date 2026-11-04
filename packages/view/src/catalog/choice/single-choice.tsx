// One choice on Radix Radio Group (design decision 8, renderer row 6), with manual activation
// (EXPERIENCE.md, Option; F-02): the arrow keys move focus only, and Space, Enter or a click
// selects, which only fills the draft. Radix's roving focus stays as it is; what changes is that
// Radix checks the radio the arrow keys move to by clicking it from its focus handler, and that
// click is cancelled here. It is the only click dispatched in the same task as a focus: a pointer
// click and Space's click come in tasks of their own. Radix leaves Enter unhandled on a radio, so
// Enter selects here. Since the ask lifecycle (ask-lifecycle, design decision 6): the "Other…" row
// last, when the question offers it, with its own text field; choosing it clears the selected
// option and choosing an option clears it (FR-3). Radios are told apart by position, never by an
// agent label, so no label can pose as "Other…".

import { RadioGroup } from "radix-ui";
import { type KeyboardEvent, type MouseEvent, useRef, useState } from "react";
import { questionTextId, useStrings } from "../port.ts";
import { OptionDetails, OtherField } from "./option-details.tsx";
import { MARK, OptionText, optionAria, ROW } from "./option-text.tsx";
import type { ChoiceProps } from "./props.ts";
import { otherLabelId } from "./selection.ts";

const OTHER = "other";
const radioOf = (index: number) => `o${index}`;

export const SingleChoice = ({ item, value, onValueChange, disabled, extras }: ChoiceProps) => {
  const { options } = item.props;
  const text = useStrings();
  const offersOther = item.props.allowOther === true && extras !== undefined;
  const other = offersOther ? extras?.other : undefined;
  const [preview, setPreview] = useState<number | undefined>(undefined);
  const chosen = options.findIndex((option) => option.label === value?.[0]);
  const selected = other !== undefined ? OTHER : chosen < 0 ? "" : radioOf(chosen);
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
  const choose = (radio: string) => {
    if (radio === OTHER) {
      onValueChange(undefined);
      extras?.onOtherChange(other ?? "");
      return;
    }
    const label = options[Number(radio.slice(1))]?.label;
    if (label === undefined) return;
    onValueChange([label]);
    if (other !== undefined) extras?.onOtherChange(undefined);
  };
  const onEnter = (radio: string) => (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    choose(radio);
  };
  return (
    <RadioGroup.Root
      aria-labelledby={questionTextId(item.id)}
      value={selected}
      onValueChange={choose}
      disabled={disabled}
      className="flex flex-col gap-sm"
    >
      {options.map((option, index) => (
        <div key={option.label} className="group/option flex flex-col gap-1">
          <RadioGroup.Item
            value={radioOf(index)}
            {...optionAria(item.id, index, option)}
            onFocus={onFocus}
            onClick={onClick}
            onKeyDown={onEnter(radioOf(index))}
            className={ROW}
          >
            <span className={`${MARK} rounded-full`}>
              <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
            </span>
            <OptionText itemId={item.id} index={index} option={option} />
          </RadioGroup.Item>
          <OptionDetails
            itemId={item.id}
            index={index}
            option={option}
            selected={index === chosen && other === undefined}
            disabled={disabled}
            extras={extras}
            previewOpen={preview === index}
            onPreview={() => setPreview(preview === index ? undefined : index)}
          />
        </div>
      ))}
      {offersOther ? (
        <div className="flex flex-col gap-1">
          <RadioGroup.Item
            value={OTHER}
            aria-labelledby={otherLabelId(item.id)}
            onFocus={onFocus}
            onClick={onClick}
            onKeyDown={onEnter(OTHER)}
            className={ROW}
          >
            <span className={`${MARK} rounded-full`}>
              <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
            </span>
            <span id={otherLabelId(item.id)} className="text-body-lg text-foreground">
              {text("option.other")}
            </span>
          </RadioGroup.Item>
          {other === undefined ? null : (
            <OtherField
              other={other}
              disabled={disabled}
              onChange={(text) => extras?.onOtherChange(text)}
            />
          )}
        </div>
      ) : null}
    </RadioGroup.Root>
  );
};
