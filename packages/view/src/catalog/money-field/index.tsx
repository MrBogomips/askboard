// The MoneyField atom's chunk (atoms, design decisions 2, 3 and 7; view-and-widgets spec: Number,
// amount and date entry in the fields, An entry blocks Answer): a text input read with the contract's
// amount parser in the ask's locale, never through a float, with the currency as an affix and the echo
// of the amount read beside it. With one `currency` the item fixes it; with `currencies` the codes
// follow the field as a segmented control, none pressed until the user picks one, and an amount typed
// before that is an entry with "Pick a currency.". An amount in a currency is the item's result
// `{amount, currency}` and clears the entry; an empty text clears both; anything else is kept as the
// entry with its reason, which disables "Answer" until corrected (AD-10). A currency picked before an
// amount is no answer, so the component keeps it until a result holds one. Answered or locked it shows
// the amount formatted, read-only.

import {
  amountEcho,
  formatMoney,
  type MoneyFieldProps,
  moneyFieldFieldCheck,
  moneyFieldPropsProblems,
  moneyFieldResultProblems,
  moneyFieldResultShape,
} from "@askboard/contract";
import { ToggleGroup } from "radix-ui";
import { useState } from "react";
import { SEGMENT, SEGMENTS } from "../fields/classes.ts";
import { EntryField } from "../fields/entry-field.tsx";
import { Field } from "../fields/field.tsx";
import { checkedProps } from "../fields/props.ts";
import {
  type ItemProps,
  register,
  useLanguage,
  useLocale,
  useReadyAfterLayout,
  useStrings,
} from "../port.ts";
import { moneyPickHandler, moneyTextHandler, readMoney, shownMoney } from "./read.ts";

/** The catalog name, which is the MoneyField item's type. */
const MONEY_FIELD = "money-field";

type UncheckedMoneyFieldItem = {
  readonly type: "money-field";
  readonly id: string;
  readonly props: unknown;
};

// The amount and currency a result holds, when it holds both as text.
const heldOf = (
  result: unknown,
): { readonly amount: string; readonly currency: string } | undefined =>
  moneyFieldResultShape(result)
    ? (result as { readonly amount: string; readonly currency: string })
    : undefined;

const MoneyField = ({
  item,
  result,
  entry,
  onResultChange,
  onEntryChange,
  disabled,
  ready,
}: ItemProps<UncheckedMoneyFieldItem>) => {
  const props = checkedProps<MoneyFieldProps>(
    "MoneyField",
    item.id,
    item.props,
    moneyFieldPropsProblems,
  );
  useReadyAfterLayout(ready);
  const locale = useLocale();
  const language = useLanguage();
  const text = useStrings();
  const [typed, remember] = useState<string | undefined>(undefined);
  const [picked, pick] = useState<string | undefined>(undefined);
  const held = heldOf(result);
  // Answered or locked: the amount in the ask's locale, read-only, with no echo, error or control.
  if (disabled) {
    return (
      <Field itemId={item.id} label={props.label} description={props.description}>
        <EntryField
          itemId={item.id}
          text={held === undefined ? "" : formatMoney(held.amount, held.currency, locale)}
          onText={remember}
          readOnly
          affix={undefined}
          echo={undefined}
          error={undefined}
          hasDescription={props.description !== undefined}
        />
      </Field>
    );
  }
  // The currency the amount is read in: the item's, else the result's, else the one picked.
  const currency = props.currency ?? held?.currency ?? picked;
  const shown = shownMoney({ entry, result, typed, locale });
  const reading =
    entry === undefined ? undefined : readMoney(entry, currency, props, locale, language);
  const refused = reading?.kind === "entry" ? reading : undefined;
  const echoOf = (): string | undefined => {
    if (refused !== undefined) return refused.echo;
    return held === undefined ? undefined : amountEcho(held.amount, held.currency, locale);
  };
  const handling = {
    props,
    locale,
    language,
    put: { result: onResultChange, entry: onEntryChange },
    currency,
    text: shown,
    remember,
    picked: pick,
  };
  const onText = moneyTextHandler(handling);
  const control =
    props.currencies === undefined ? undefined : (
      <ToggleGroup.Root
        type="single"
        value={currency ?? ""}
        aria-label={text("field.currency")}
        className={SEGMENTS}
        onValueChange={moneyPickHandler(handling)}
      >
        {props.currencies.map((code) => (
          <ToggleGroup.Item key={code} value={code} className={SEGMENT}>
            {code}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    );
  return (
    <Field
      itemId={item.id}
      label={props.label}
      description={props.description}
      required={props.required === true}
    >
      <EntryField
        itemId={item.id}
        text={shown}
        onText={onText}
        readOnly={false}
        affix={currency}
        echo={echoOf()}
        error={refused?.error}
        hasDescription={props.description !== undefined}
        required={props.required === true}
        after={control}
      />
    </Field>
  );
};

// The facts the shell needs of the MoneyField: its name in the agent-change notice, and whether a
// result fits its props, by the contract's shape and props checks, the two `widgetResultFits` runs.
register(MONEY_FIELD, MoneyField, {
  name: "change.widgetMoneyField",
  fits: (result, props) =>
    moneyFieldResultShape(result) && moneyFieldResultProblems(result, props).length === 0,
  check: moneyFieldFieldCheck,
});
