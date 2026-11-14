// Several choices on Radix Checkbox (design decision 8, renderer row 6). The boxes are one Tab
// stop, with the arrow keys moving focus among them and never checking one (EXPERIENCE.md, Tab
// order and Option); Space, Enter or a click checks or unchecks, which only fills the draft.
// Radix leaves Enter unhandled on a checkbox, so Enter toggles here. Since the ask lifecycle
// (ask-lifecycle, design decision 6): the "Other…" box last, when the question offers it, with its
// own text field, checked beside any option (FR-3).

import { Checkbox } from "radix-ui";
import { type KeyboardEvent, useRef, useState } from "react";
import { checkboxKeyOf } from "../fields/roving.ts";
import { questionTextId, useStrings } from "../port.ts";
import { OptionDetails, OtherField } from "./option-details.tsx";
import { MARK, OptionText, optionAria, ROW } from "./option-text.tsx";
import type { ChoiceProps } from "./props.ts";
import { otherLabelId, toggled } from "./selection.ts";

export const MultipleChoice = ({ item, value, onValueChange, disabled, extras }: ChoiceProps) => {
  const { options } = item.props;
  const text = useStrings();
  const offersOther = item.props.allowOther === true && extras !== undefined;
  const other = offersOther ? extras?.other : undefined;
  const count = options.length + (offersOther ? 1 : 0);
  const [preview, setPreview] = useState<number | undefined>(undefined);
  // Which box is the Tab stop: where focus is, not what is chosen.
  const [stop, setStop] = useState(0);
  const boxes = useRef<(HTMLButtonElement | null)[]>([]);
  const toggle = (label: string, checked: boolean) =>
    onValueChange(toggled(options, value, label, checked));
  const toggleOther = (checked: boolean) =>
    extras?.onOtherChange(checked ? (other ?? "") : undefined);
  const onKeyDown = (index: number, flip: () => void) => (event: KeyboardEvent) => {
    const action = checkboxKeyOf(event, index, count);
    if (action === undefined) return;
    event.preventDefault();
    if (action.kind === "flip") flip();
    else boxes.current[action.index]?.focus();
  };
  const boxAt = (index: number) => ({
    ref: (box: HTMLButtonElement | null) => {
      boxes.current[index] = box;
    },
    tabIndex: index === stop ? 0 : -1,
    onFocus: () => setStop(index),
    disabled,
    className: ROW,
  });
  return (
    <fieldset aria-labelledby={questionTextId(item.id)} className="flex flex-col gap-sm">
      {options.map((option, index) => {
        const checked = value?.includes(option.label) === true;
        return (
          <div key={option.label} className="group/option flex flex-col gap-1">
            <Checkbox.Root
              {...boxAt(index)}
              checked={checked}
              onCheckedChange={(next) => toggle(option.label, next === true)}
              onKeyDown={onKeyDown(index, () => toggle(option.label, !checked))}
              {...optionAria(item.id, index, option)}
            >
              <span className={`${MARK} rounded-md`}>
                <Checkbox.Indicator className="size-2 bg-primary" />
              </span>
              <OptionText itemId={item.id} index={index} option={option} />
            </Checkbox.Root>
            <OptionDetails
              itemId={item.id}
              index={index}
              option={option}
              selected={checked}
              disabled={disabled}
              extras={extras}
              previewOpen={preview === index}
              onPreview={() => setPreview(preview === index ? undefined : index)}
            />
          </div>
        );
      })}
      {offersOther ? (
        <div className="flex flex-col gap-1">
          <Checkbox.Root
            {...boxAt(options.length)}
            checked={other !== undefined}
            onCheckedChange={(next) => toggleOther(next === true)}
            onKeyDown={onKeyDown(options.length, () => toggleOther(other === undefined))}
            aria-labelledby={otherLabelId(item.id)}
          >
            <span className={`${MARK} rounded-md`}>
              <Checkbox.Indicator className="size-2 bg-primary" />
            </span>
            <span id={otherLabelId(item.id)} className="text-body-lg text-foreground">
              {text("option.other")}
            </span>
          </Checkbox.Root>
          {other === undefined ? null : (
            <OtherField
              other={other}
              disabled={disabled}
              onChange={(text) => extras?.onOtherChange(text)}
            />
          )}
        </div>
      ) : null}
    </fieldset>
  );
};
