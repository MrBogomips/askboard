// The Value atom's chunk (atoms, design decisions 4 and 8; view-and-widgets spec: Display atoms): a
// figure the user reads, in the code type and in the ask's locale, under an optional label. It gives
// no answer, takes no focus and registers no facts. Props the contract refuses fail the item, which
// the item's error boundary shows (AD-10); it reports itself ready once it has been laid out (AD-9).

import { type ValueProps, valuePropsProblems } from "@askboard/contract";
import { type ItemProps, register, useLocale, useReadyAfterLayout } from "../port.ts";
import { FIGURE, LABEL, VALUE } from "./classes.ts";
import { valueText } from "./format.ts";

/** The catalog name, which is the Value item's type. */
const VALUE_TYPE = "value";

type UncheckedValueItem = {
  readonly type: "value";
  readonly id: string;
  readonly props: unknown;
};

const checked = (item: UncheckedValueItem): ValueProps => {
  const problems = valuePropsProblems(item.props);
  if (problems.length > 0) {
    const said = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
    throw new Error(`the Value "${item.id}" refuses its props: ${said}`);
  }
  return item.props as ValueProps;
};

const Value = ({ item, ready }: ItemProps<UncheckedValueItem>) => {
  const props = checked(item);
  const locale = useLocale();
  useReadyAfterLayout(ready);
  const figure = valueText(props, locale);
  if (props.label === undefined) {
    return <p className={`${VALUE} ${FIGURE}`}>{figure}</p>;
  }
  return (
    <dl className={VALUE}>
      <dt className={LABEL}>{props.label}</dt>
      <dd className={FIGURE}>{figure}</dd>
    </dl>
  );
};

register(VALUE_TYPE, Value);
