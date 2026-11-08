// The Toggle atom's chunk (atoms, design decisions 4 and 7; view-and-widgets spec: The Toggle's unset
// state): a Radix Switch drawn off while it is unset, with "Not set" beside it. A press sets the
// opposite of the state shown, so the first press is on; "On" or "Off" then reads beside it with a
// "Clear" `button-link` that returns it to unset, removing its result. An off Toggle is an answer
// (`false`); an unset one gives none (AD-10). Answered or locked it is read-only and shows the
// state as text. It holds no entry and no state of its own (AD-9).

import {
  type ToggleProps,
  toggleFieldCheck,
  togglePropsProblems,
  toggleResultShape,
} from "@askboard/contract";
import { Switch } from "radix-ui";
import { BUTTON_LINK, DESCRIPTION } from "../fields/classes.ts";
import { fieldIds, RequiredMark } from "../fields/field.tsx";
import { checkedProps } from "../fields/props.ts";
import { putting } from "../fields/text.ts";
import { type ItemProps, register, useReadyAfterLayout, useStrings } from "../port.ts";
import { ROOT, ROW, STATE, STATE_SET, THUMB, TOGGLE_LABEL } from "./classes.ts";

/** The catalog name, which is the Toggle item's type. */
const TOGGLE = "toggle";

type UncheckedToggleItem = {
  readonly type: "toggle";
  readonly id: string;
  readonly props: unknown;
};

const Toggle = ({
  item,
  result,
  onResultChange,
  disabled,
  ready,
}: ItemProps<UncheckedToggleItem>) => {
  const props = checkedProps<ToggleProps>("Toggle", item.id, item.props, togglePropsProblems);
  useReadyAfterLayout(ready);
  const text = useStrings();
  const ids = fieldIds(item.id);
  const shown = typeof result === "boolean" ? result : undefined;
  const state =
    shown === undefined ? text("toggle.notSet") : shown ? text("toggle.on") : text("toggle.off");
  const described = props.description === undefined ? ids.state : `${ids.state} ${ids.description}`;
  return (
    <div data-askboard-field={item.id} className="flex min-w-0 flex-col gap-xs">
      <div className={ROW}>
        <Switch.Root
          id={ids.control}
          checked={shown === true}
          disabled={disabled}
          required={props.required === true && !disabled}
          aria-labelledby={ids.label}
          aria-describedby={described}
          className={ROOT}
          onCheckedChange={onResultChange}
        >
          <Switch.Thumb className={THUMB} />
        </Switch.Root>
        <label id={ids.label} htmlFor={ids.control} className={TOGGLE_LABEL}>
          {props.label}
          {props.required === true && !disabled ? (
            <>
              {" "}
              <RequiredMark />
            </>
          ) : null}
        </label>
        <span id={ids.state} className={shown === undefined ? STATE : STATE_SET}>
          {state}
        </span>
        {shown === undefined || disabled ? null : (
          <button
            type="button"
            className={BUTTON_LINK}
            onClick={putting(onResultChange, undefined)}
          >
            {text("toggle.clear")}
          </button>
        )}
      </div>
      {props.description === undefined ? null : (
        <p id={ids.description} className={DESCRIPTION}>
          {props.description}
        </p>
      )}
    </div>
  );
};

// The facts the shell needs of the Toggle: its name in the agent-change notice, and whether a result
// fits it, by the contract's shape check, a boolean, the only check its result has.
register(TOGGLE, Toggle, {
  name: "change.widgetToggle",
  fits: toggleResultShape,
  check: toggleFieldCheck,
});
