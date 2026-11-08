// One choice on AskBoard's own radio group (choice-documented-activation, design decisions 1 and
// 3; renderer row 6), with manual activation (EXPERIENCE.md, Option; F-02): the arrow keys, Home
// and End move focus only, and Space, Enter or a click checks, which only fills the draft. The
// radios are buttons with the `radio` role, a roving tab stop and the keys of `fields/roving.ts`,
// so no library behaviour decides what is checked, and a radio already checked changes nothing.
// Since the ask lifecycle (ask-lifecycle, design decision 6): the "Other…" row last, when the
// question offers it, with its own text field; choosing it clears the selected option and choosing
// an option clears it (FR-3). Radios are told apart by position, never by an agent label, so no
// label can pose as "Other…".

import { useState } from "react";
import { useRadios } from "../fields/radios.ts";
import { questionTextId, useStrings } from "../port.ts";
import { OptionDetails, OtherField } from "./option-details.tsx";
import { MARK, OptionText, optionAria, ROW } from "./option-text.tsx";
import type { ChoiceProps } from "./props.ts";
import { choosingSingle, otherLabelId, previewToggling } from "./selection.ts";

const DOT = "size-2 rounded-full bg-primary";

export const SingleChoice = ({ item, value, onValueChange, disabled, extras }: ChoiceProps) => {
  const { options } = item.props;
  const text = useStrings();
  const offered = item.props.allowOther === true ? extras : undefined;
  const offersOther = offered !== undefined;
  const other = offered?.other;
  const [preview, setPreview] = useState<number | undefined>(undefined);
  const chosen = options.findIndex((option) => option.label === value?.[0]);
  const checked = other !== undefined ? options.length : chosen < 0 ? undefined : chosen;
  const radio = useRadios({
    count: options.length + (offersOther ? 1 : 0),
    checked,
    disabled,
    onCheck: choosingSingle({
      options,
      other,
      onValueChange,
      onOtherChange: offered?.onOtherChange,
    }),
  });
  const togglePreview = previewToggling(preview, setPreview);
  return (
    <div
      role="radiogroup"
      aria-labelledby={questionTextId(item.id)}
      className="flex flex-col gap-sm"
    >
      {options.map((option, index) => (
        <div key={option.label} className="group/option flex flex-col gap-1">
          <button {...radio(index)} {...optionAria(item.id, index, option)} className={ROW}>
            <span className={`${MARK} rounded-full`}>
              {checked === index ? <span className={DOT} /> : null}
            </span>
            <OptionText itemId={item.id} index={index} option={option} />
          </button>
          <OptionDetails
            itemId={item.id}
            index={index}
            option={option}
            selected={index === chosen && other === undefined}
            disabled={disabled}
            extras={extras}
            previewOpen={preview === index}
            onPreview={togglePreview(index)}
          />
        </div>
      ))}
      {offersOther ? (
        <div className="flex flex-col gap-1">
          <button
            {...radio(options.length)}
            aria-labelledby={otherLabelId(item.id)}
            className={ROW}
          >
            <span className={`${MARK} rounded-full`}>
              {checked === options.length ? <span className={DOT} /> : null}
            </span>
            <span id={otherLabelId(item.id)} className="text-body-lg text-foreground">
              {text("option.other")}
            </span>
          </button>
          {other === undefined ? null : (
            <OtherField other={other} disabled={disabled} onChange={offered.onOtherChange} />
          )}
        </div>
      ) : null}
    </div>
  );
};
