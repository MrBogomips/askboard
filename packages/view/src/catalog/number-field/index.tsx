// The NumberField atom's chunk (atoms, design decisions 3, 4 and 7; view-and-widgets spec: Number,
// amount and date entry in the fields, An entry blocks Answer): a text input read with the contract's
// parser in the ask's locale, never the browser's number input, with the unit as an affix and the
// echo of the value read beside it. A value within the bounds is the item's result and clears the
// entry; an empty text clears both; anything else is kept as the item's entry, with the parser's
// reason or the bound broken as the field error, which disables "Answer" until it is corrected
// (AD-10). The text shown is the entry while one is held, else the result written back; the one
// thing the component keeps itself is the text as typed, so that a trailing zero is not lost while
// it still reads as the result. Answered or locked it shows the value formatted, read-only.

import {
  formatNumber,
  type NumberFieldProps,
  numberEcho,
  numberFieldFieldCheck,
  numberFieldPropsProblems,
  numberFieldResultProblems,
  numberFieldResultShape,
} from "@askboard/contract";
import { useState } from "react";
import { EntryField } from "../fields/entry-field.tsx";
import { Field } from "../fields/field.tsx";
import { checkedProps } from "../fields/props.ts";
import { type ItemProps, register, useLanguage, useLocale, useReadyAfterLayout } from "../port.ts";
import { numberTextHandler, readNumber, shownNumber } from "./read.ts";

/** The catalog name, which is the NumberField item's type. */
const NUMBER_FIELD = "number-field";

type UncheckedNumberFieldItem = {
  readonly type: "number-field";
  readonly id: string;
  readonly props: unknown;
};

const NumberField = ({
  item,
  result,
  entry,
  onResultChange,
  onEntryChange,
  disabled,
  ready,
}: ItemProps<UncheckedNumberFieldItem>) => {
  const props = checkedProps<NumberFieldProps>(
    "NumberField",
    item.id,
    item.props,
    numberFieldPropsProblems,
  );
  useReadyAfterLayout(ready);
  const locale = useLocale();
  const language = useLanguage();
  const [typed, remember] = useState<string | undefined>(undefined);
  const held = typeof result === "number" ? result : undefined;
  // Answered or locked: the value in the ask's locale, read-only, with no echo and no error.
  if (disabled) {
    return (
      <Field itemId={item.id} label={props.label} description={props.description}>
        <EntryField
          itemId={item.id}
          text={held === undefined ? "" : formatNumber(held, locale)}
          onText={remember}
          readOnly
          affix={props.unit}
          echo={undefined}
          error={undefined}
          hasDescription={props.description !== undefined}
        />
      </Field>
    );
  }
  const reading = entry === undefined ? undefined : readNumber(entry, props, locale, language);
  const refused = reading?.kind === "entry" ? reading : undefined;
  const echo =
    refused === undefined
      ? held === undefined
        ? undefined
        : numberEcho(held, locale)
      : refused.echo;
  const onText = numberTextHandler({
    props,
    locale,
    language,
    put: { result: onResultChange, entry: onEntryChange },
    remember,
  });
  return (
    <Field
      itemId={item.id}
      label={props.label}
      description={props.description}
      required={props.required === true}
    >
      <EntryField
        itemId={item.id}
        text={shownNumber({ entry, result, typed, locale })}
        onText={onText}
        readOnly={false}
        affix={props.unit}
        echo={echo}
        error={refused?.error}
        hasDescription={props.description !== undefined}
        required={props.required === true}
      />
    </Field>
  );
};

// The facts the shell needs of the NumberField: its name in the agent-change notice, and whether a
// result fits its props, by the contract's shape and props checks, the two `widgetResultFits` runs.
register(NUMBER_FIELD, NumberField, {
  name: "change.widgetNumberField",
  fits: (result, props) =>
    numberFieldResultShape(result) && numberFieldResultProblems(result, props).length === 0,
  check: numberFieldFieldCheck,
});
