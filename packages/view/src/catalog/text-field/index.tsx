// The TextField atom's chunk (atoms, design decisions 3, 4 and 7; view-and-widgets spec: Input atoms
// fill the draft only): an input, or a textarea with `multiline`, whose text is the item's result.
// It starts unset and shows nothing as set before the user acts; each input keeps the first
// `maxLength` code points (the attribute counts UTF-16 units, so none is set), and an empty field
// holds no result. It holds no entry, since any text within the cap is a value, and no state of its
// own: the field shows the result the draft holds (AD-9). Answered or locked it is read-only.

import {
  TEXT_FIELD_MAX_CHARS,
  type TextFieldProps,
  textFieldPropsProblems,
  textFieldResultProblems,
  textFieldResultShape,
} from "@askboard/contract";
import { INPUT, TEXTAREA } from "../fields/classes.ts";
import { Field, fieldIds } from "../fields/field.tsx";
import { checkedProps } from "../fields/props.ts";
import { textChange, typed } from "../fields/text.ts";
import { type ItemProps, register, useReadyAfterLayout } from "../port.ts";

/** The catalog name, which is the TextField item's type. */
const TEXT_FIELD = "text-field";

type UncheckedTextFieldItem = {
  readonly type: "text-field";
  readonly id: string;
  readonly props: unknown;
};

const TextField = ({
  item,
  result,
  onResultChange,
  disabled,
  ready,
}: ItemProps<UncheckedTextFieldItem>) => {
  const props = checkedProps<TextFieldProps>(
    "TextField",
    item.id,
    item.props,
    textFieldPropsProblems,
  );
  useReadyAfterLayout(ready);
  const ids = fieldIds(item.id);
  const max = props.maxLength ?? TEXT_FIELD_MAX_CHARS;
  const text = typeof result === "string" ? result : "";
  const onChange = typed(textChange(max, onResultChange));
  const shared = {
    id: ids.control,
    value: text,
    readOnly: disabled,
    ...(props.description === undefined ? {} : { "aria-describedby": ids.description }),
  };
  return (
    <Field itemId={item.id} label={props.label} description={props.description}>
      {props.multiline === true ? (
        <textarea {...shared} rows={3} className={TEXTAREA} onChange={onChange} />
      ) : (
        <input {...shared} type="text" className={INPUT} onChange={onChange} />
      )}
    </Field>
  );
};

// The facts the shell needs of the TextField: its name in the agent-change notice, and whether a
// result fits its props, by the contract's shape and props checks, the two `widgetResultFits` runs.
register(TEXT_FIELD, TextField, {
  name: "change.widgetTextField",
  fits: (result, props) =>
    textFieldResultShape(result) && textFieldResultProblems(result, props).length === 0,
});
