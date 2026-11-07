// A Value's figure as text in the ask's locale (atoms, design decision 8; view-and-widgets spec:
// Display atoms): numbers, percentages, money and long dates from AskBoard's own formats (never
// `Intl`), a number's unit once after it, and a duration as days through the string table.
// Plain functions, tested without a DOM.

import {
  formatLongDate,
  formatMoney,
  formatNumber,
  formatPercent,
  type Locale,
  type ValueProps,
} from "@askboard/contract";
import { say } from "../port.ts";

/** The text a Value shows for its figure; the label is the component's. */
export const valueText = (props: ValueProps, locale: Locale): string => {
  switch (props.kind) {
    case "number": {
      const figure = formatNumber(props.value, locale);
      return props.unit === undefined ? figure : `${figure} ${props.unit}`;
    }
    case "percent":
      return formatPercent(props.value, locale);
    case "money":
      return formatMoney(props.amount, props.currency, locale);
    case "date":
      return formatLongDate(props.date, locale);
    case "duration":
      return say(locale, "value.days", { count: props.days });
  }
};
