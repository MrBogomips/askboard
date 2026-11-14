// Shared by the Form chunks (task 4.4): the AskBoard theme stand-in (RJSF widgets on the input
// atoms' parts: a text input, Radix Radio Group, Select and Checkbox) and the Form component,
// parameterised by its validator so the Ajv negative control lives in a chunk of its own.

import Form from "@rjsf/core";
import type { RegistryWidgetsType, ValidatorType, WidgetProps } from "@rjsf/utils";
import { Checkbox, RadioGroup, Select } from "radix-ui";
import { type ItemProps, useReadyAfterLayout } from "../port/index.ts";
import { shimStyleElements } from "./_style-shim.ts";
import { inputClass } from "./_field.tsx";

type EnumOption = { label: string; value: string };
const enumOptions = (props: WidgetProps): EnumOption[] => (props.options.enumOptions ?? []) as EnumOption[];
const box = "flex size-4 items-center justify-center border border-input bg-card data-[state=checked]:border-primary";

const TextWidget = (props: WidgetProps) => (
  <input
    id={props.id}
    type="text"
    className={inputClass}
    value={props.value ?? ""}
    onChange={(e) => props.onChange(e.target.value === "" ? undefined : e.target.value)}
  />
);

const RadioWidget = (props: WidgetProps) => (
  <RadioGroup.Root id={props.id} value={props.value ?? ""} onValueChange={(v) => props.onChange(v)} className="flex flex-col gap-1">
    {enumOptions(props).map((o) => (
      <div key={o.value} className="flex items-center gap-2">
        <RadioGroup.Item id={`${props.id}-${o.value}`} value={o.value} className={`${box} rounded-full`}>
          <RadioGroup.Indicator className="size-2 rounded-full bg-primary" />
        </RadioGroup.Item>
        <label htmlFor={`${props.id}-${o.value}`} className="text-body">
          {o.label}
        </label>
      </div>
    ))}
  </RadioGroup.Root>
);

const SelectWidget = (props: WidgetProps) => (
  <Select.Root value={props.value ?? undefined} onValueChange={(v) => props.onChange(v)}>
    <Select.Trigger id={props.id} className={`${inputClass} flex justify-between`}>
      <Select.Value placeholder="Choose" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Content position="popper" className="rounded-md border border-border bg-popover shadow-md">
        <Select.Viewport className="p-1">
          {enumOptions(props).map((o) => (
            <Select.Item key={o.value} value={o.value} className="px-2 py-1 text-body data-[highlighted]:bg-accent">
              <Select.ItemText>{o.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
);

const CheckboxesWidget = (props: WidgetProps) => {
  const chosen = Array.isArray(props.value) ? (props.value as string[]) : [];
  return (
    <div id={props.id} className="flex flex-col gap-1">
      {enumOptions(props).map((o) => (
        <div key={o.value} className="flex items-center gap-2">
          <Checkbox.Root
            id={`${props.id}-${o.value}`}
            className={`${box} rounded-sm`}
            checked={chosen.includes(o.value)}
            onCheckedChange={(on) =>
              props.onChange(on === true ? [...chosen, o.value] : chosen.filter((v) => v !== o.value))
            }
          >
            <Checkbox.Indicator className="size-2 bg-primary" />
          </Checkbox.Root>
          <label htmlFor={`${props.id}-${o.value}`} className="text-body">
            {o.label}
          </label>
        </div>
      ))}
    </div>
  );
};

const widgets: RegistryWidgetsType = { TextWidget, RadioWidget, SelectWidget, CheckboxesWidget };

// S-4: no schema validation in the view; field checks come from AskBoard as `extraErrors`.
export const noopValidator: ValidatorType = {
  validateFormData: () => ({ errors: [], errorSchema: {} }),
  isValid: () => true,
  rawValidation: () => ({ errors: [], validationError: undefined }),
  reset: () => {},
};

// The values are the item's value in the draft record. `props.asForm` is S-7's negative control:
// the default `<form>` tag with its submit button. A submission is recorded as view state.
export const formFor =
  (validator: ValidatorType, live = false) =>
  ({ item, draft, emit, ready }: ItemProps) => {
    useReadyAfterLayout(ready);
    // The SelectWidget's Radix Select locks scroll while open: the style-element shim, as for S-6.
    if (item.props?.styleShim === true) shimStyleElements();
    const asForm = item.props?.asForm === true;
    const uiSchema = {
      ...(item.props?.uiSchema as object),
      ...(asForm ? {} : { "ui:submitButtonOptions": { norender: true } }),
    };
    return (
      <Form
        schema={item.props?.schema as object}
        uiSchema={uiSchema}
        formData={draft ?? {}}
        validator={validator}
        widgets={widgets}
        tagName={asForm ? "form" : "div"}
        showErrorList={false}
        liveValidate={live ? "onChange" : undefined}
        extraErrors={item.props?.extraErrors as object}
        onChange={(event) => emit({ type: "draft.set", id: item.id, value: event.formData })}
        onSubmit={() => emit({ type: "ui.set", id: item.id, value: "submitted" })}
      />
    );
  };
