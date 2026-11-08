// The TextField atom's chunk (atoms, design decisions 3, 4 and 7; form-widget, design decisions 3
// and 6; view-and-widgets spec: Input atoms fill the draft only, A TextField's checks as the user
// types): an input, or a textarea with `multiline`, whose text is the item's result. It starts unset
// and shows nothing as set before the user acts; each input keeps the first `textFieldLimit` code
// points (`maxLength`, else 100 beside a pattern, else 10,000; the attribute counts UTF-16 units, so
// none is set), and an empty field holds no result. It holds no entry, since any text within the cap
// is a value, and no state of its own: the field shows the result the draft holds (AD-9). A text
// shorter than `minLength` or outside `pattern` is kept as typed and shown with its field error under
// it; the pattern is the agent's and runs here and nowhere else, on text capped by the limit, and
// its text is never drawn. Answered or locked it is read-only and shows no error.

import {
  type TextFieldProps,
  textFieldFieldCheck,
  textFieldLimit,
  textFieldPatternFailure,
  textFieldPropsProblems,
  textFieldResultProblems,
  textFieldResultShape,
} from "@askboard/contract";
import { fieldErrorOf } from "../fields/check-text.ts";
import { FIELD_ERROR, INPUT, TEXTAREA } from "../fields/classes.ts";
import { Field, fieldIds } from "../fields/field.tsx";
import { checkedProps } from "../fields/props.ts";
import { textChange, typed } from "../fields/text.ts";
import { type ItemProps, register, useReadyAfterLayout, useStrings } from "../port.ts";

/** The catalog name, which is the TextField item's type. */
const TEXT_FIELD = "text-field";

type UncheckedTextFieldItem = {
  readonly type: "text-field";
  readonly id: string;
  readonly props: unknown;
};

/**
 * The TextField's whole check, as the shell and the field read it: `required` and `minLength`
 * (the contract's field check), then the pattern, which only the board runs.
 */
const checkTextField = (result: unknown, props: unknown) =>
  textFieldFieldCheck(result, props) ?? textFieldPatternFailure(result, props);

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
  const say = useStrings();
  const ids = fieldIds(item.id);
  const max = textFieldLimit(props);
  const text = typeof result === "string" ? result : "";
  const onChange = typed(textChange(max, onResultChange));
  // A text the draft holds that fails its check shows the error; an empty field, which holds no
  // result, and a read-only one show none (the empty required field asks through its label).
  const error = disabled ? undefined : fieldErrorOf(checkTextField(result, props), say);
  const described = [
    ...(props.description === undefined ? [] : [ids.description]),
    ...(error === undefined ? [] : [ids.error]),
  ].join(" ");
  const shared = {
    id: ids.control,
    value: text,
    readOnly: disabled,
    "aria-required": props.required === true && !disabled ? true : undefined,
    "aria-invalid": error === undefined ? undefined : true,
    "aria-describedby": described === "" ? undefined : described,
  } as const;
  return (
    <Field
      itemId={item.id}
      label={props.label}
      description={props.description}
      required={props.required === true && !disabled}
    >
      {props.multiline === true ? (
        <textarea {...shared} rows={3} className={TEXTAREA} onChange={onChange} />
      ) : (
        <input {...shared} type="text" className={INPUT} onChange={onChange} />
      )}
      {error === undefined ? null : (
        <p id={ids.error} className={FIELD_ERROR}>
          {error}
        </p>
      )}
    </Field>
  );
};

// The facts the shell needs of the TextField: its name in the agent-change notice, whether a result
// fits its props (the contract's shape and props checks, the two `widgetResultFits` runs; a text
// that fails only its check still fits), and its check, which blocks "Answer" while it fails.
register(TEXT_FIELD, TextField, {
  name: "change.widgetTextField",
  fits: (result, props) =>
    textFieldResultShape(result) && textFieldResultProblems(result, props).length === 0,
  check: checkTextField,
});
