// The PickField's chunk (form-widget, design decision 4; view-and-widgets spec: The PickField, The
// PickField's filter, Forms read-only and in Snapshots, Form strings): a pick from a list of the
// agent's options. A single pick is AskBoard's own radio group (choice-documented-activation: Tab
// into the group, the arrow keys move the focus only, Space, Enter or a click picks) and a "Clear"
// `button-link` while one is picked; a multiple pick is one Radix Checkbox per option, Space
// toggling. Nothing is picked until the user picks
// (AD-10), and a pick only fills the draft: the result is the option's ID, or the IDs in the
// options' order (FR-11, FR-13). Above more than `PICK_FILTER_OVER` options a filter input shows the
// options whose label holds its text, ignoring case: its text is this component's own view state,
// never in the draft, and a pick it hides stays picked. A multiple pick outside `minItems` or
// `maxItems` shows its field error as picked; an empty required field shows none. Read-only, as
// when answered, the picks are checked and the controls disabled, with no filter, no "Clear" and no
// required mark. Labels, descriptions and option texts are agent text, shown as text and wrapped
// (AD-8). It edits nothing and holds no state but the filter's.

import {
  type PickFieldProps,
  type PickOption,
  pickFieldFieldCheck,
  pickFieldPropsProblems,
  pickFieldResultProblems,
  pickFieldResultShape,
} from "@askboard/contract";
import { Checkbox } from "radix-ui";
import { type ReactNode, useRef, useState } from "react";
import { fieldErrorOf } from "../fields/check-text.ts";
import { BUTTON_LINK, FIELD_ERROR, INPUT } from "../fields/classes.ts";
import { Field, fieldIds } from "../fields/field.tsx";
import { checkedProps } from "../fields/props.ts";
import { useRadios } from "../fields/radios.ts";
import { typed } from "../fields/text.ts";
import { type ItemProps, register, useReadyAfterLayout, useStrings } from "../port.ts";
import {
  CLEAR,
  MARK,
  NO_MATCH,
  OPTION_DESCRIPTION,
  OPTION_LABEL,
  OPTION_TEXT,
  OPTIONS,
  ROW,
} from "./classes.ts";
import {
  checkedAmong,
  clearing,
  filteredOptions,
  focusFirstRadio,
  picking,
  showsFilter,
  toggling,
} from "./selection.ts";

/** The catalog name, which is the PickField item's type. */
const PICK_FIELD = "pick-field";

type UncheckedPickFieldItem = {
  readonly type: "pick-field";
  readonly id: string;
  readonly props: unknown;
};

/** The checked radio's dot. */
const DOT = "size-2 rounded-full bg-primary";

const labelId = (itemId: string, index: number) => `${itemId}:option:${index}:label`;
const descriptionId = (itemId: string, index: number) => `${itemId}:option:${index}:description`;

type OptionTextProps = {
  readonly itemId: string;
  readonly index: number;
  readonly label: string;
  readonly description: string | undefined;
};

const OptionText = ({ itemId, index, label, description }: OptionTextProps) => (
  <span className={OPTION_TEXT}>
    <span id={labelId(itemId, index)} className={OPTION_LABEL}>
      {label}
    </span>
    {description === undefined ? null : (
      <span id={descriptionId(itemId, index)} className={OPTION_DESCRIPTION}>
        {description}
      </span>
    )}
  </span>
);

const optionText = (itemId: string, index: number, option: PickOption) => (
  <OptionText itemId={itemId} index={index} label={option.label} description={option.description} />
);

const aria = (itemId: string, index: number, description: string | undefined) => ({
  "aria-labelledby": labelId(itemId, index),
  "aria-describedby": description === undefined ? undefined : descriptionId(itemId, index),
});

const PickField = ({
  item,
  result,
  onResultChange,
  disabled,
  ready,
}: ItemProps<UncheckedPickFieldItem>) => {
  const props = checkedProps<PickFieldProps>(
    "PickField",
    item.id,
    item.props,
    pickFieldPropsProblems,
  );
  useReadyAfterLayout(ready);
  const say = useStrings();
  const ids = fieldIds(item.id);
  const [filter, setFilter] = useState("");
  const group = useRef<HTMLDivElement>(null);
  const { options } = props;
  const multiple = props.multiple === true;
  const required = props.required === true && !disabled;
  const filtering = showsFilter(options.length, disabled);
  const shown = filtering ? filteredOptions(options, filter) : options;
  // What the result holds, whatever its shape: the draft only ever holds a fitting one.
  const single = !multiple && typeof result === "string" ? result : undefined;
  const picked: readonly string[] =
    multiple && Array.isArray(result)
      ? result.filter((id): id is string => typeof id === "string")
      : [];
  const error = disabled ? undefined : fieldErrorOf(pickFieldFieldCheck(result, props), say);
  const described = [
    ...(props.description === undefined ? [] : [ids.description]),
    ...(error === undefined ? [] : [ids.error]),
  ].join(" ");
  // The button leaves with the pick: focus goes to the group's first radio, not to the page.
  const clear = clearing(onResultChange, () => focusFirstRadio(group.current));
  const checked = checkedAmong(shown, single);
  const radio = useRadios({
    count: multiple ? 0 : shown.length,
    checked,
    disabled,
    onCheck: picking(shown, onResultChange),
  });
  const rows: ReactNode = shown.map((option, position) => {
    const index = options.indexOf(option);
    const text = optionText(item.id, index, option);
    const shared = { ...aria(item.id, index, option.description), className: ROW };
    return multiple ? (
      <Checkbox.Root
        key={option.id}
        {...shared}
        checked={picked.includes(option.id)}
        disabled={disabled}
        onCheckedChange={toggling(options, picked, option.id, onResultChange)}
      >
        <span className={`${MARK} rounded-md`}>
          <Checkbox.Indicator className="size-2 bg-primary" />
        </span>
        {text}
      </Checkbox.Root>
    ) : (
      <button key={option.id} {...radio(position)} {...shared}>
        <span className={`${MARK} rounded-full`}>
          {position === checked ? <span className={DOT} /> : null}
        </span>
        {text}
      </button>
    );
  });
  const empty =
    shown.length === 0 ? (
      <p role="status" className={NO_MATCH}>
        {say("pick.noMatch")}
      </p>
    ) : null;
  const common = {
    id: ids.control,
    "aria-labelledby": ids.label,
    "aria-describedby": described === "" ? undefined : described,
    className: OPTIONS,
  };
  return (
    <Field itemId={item.id} label={props.label} description={props.description} required={required}>
      {filtering ? (
        <input
          type="text"
          id={`${item.id}:filter`}
          aria-label={say("pick.filter")}
          placeholder={say("pick.filter")}
          autoComplete="off"
          value={filter}
          className={INPUT}
          onChange={typed(setFilter)}
        />
      ) : null}
      {multiple ? (
        <fieldset {...common}>
          {rows}
          {empty}
        </fieldset>
      ) : (
        <div role="radiogroup" {...common} ref={group} aria-required={required ? true : undefined}>
          {rows}
          {empty}
        </div>
      )}
      {single === undefined || disabled ? null : (
        <button type="button" className={`${BUTTON_LINK} ${CLEAR}`} onClick={clear}>
          {say("pick.clear")}
        </button>
      )}
      {error === undefined ? null : (
        <p id={ids.error} className={FIELD_ERROR}>
          {error}
        </p>
      )}
    </Field>
  );
};

// The facts the shell needs of the PickField: its name in the agent-change notice, whether a result
// fits its props (the contract's shape and props checks, the two `widgetResultFits` runs: an option
// ID, or IDs in the options' order, each an option's), and its check, which blocks "Answer" while a
// required field is empty or a multiple pick is outside its counts.
register(PICK_FIELD, PickField, {
  name: "change.widgetPickField",
  fits: (result, props) =>
    pickFieldResultShape(result) && pickFieldResultProblems(result, props).length === 0,
  check: pickFieldFieldCheck,
});
