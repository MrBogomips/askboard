// A Scale's props as the component takes them (design decision 8): the view hands props over as
// data, unchecked, so the shape the schema would give is checked here, then the contract's own
// checks of what a schema cannot say. A problem throws, naming the item; the item's error
// boundary then fails it and its question never counts as visible (AD-10).

import { SCALE_DISPLAYS, type ScaleProps, scalePropsProblems } from "@askboard/contract";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finite = (value: unknown): boolean => typeof value === "number" && Number.isFinite(value);

const optional = (value: unknown, ok: (value: unknown) => boolean): boolean =>
  value === undefined || ok(value);

// What the schema says of the fields: the bounds and the step are finite numbers, the flags,
// labels and unit are of their type, the display one of the two.
const shapeProblem = (props: unknown): string | undefined => {
  if (!isRecord(props)) return "its props are no object";
  if (!finite(props.min) || !finite(props.max)) return "min and max are not both numbers";
  const text = (value: unknown) => typeof value === "string";
  const fields: readonly [string, boolean][] = [
    ["step", optional(props.step, finite)],
    ["range", optional(props.range, (value) => typeof value === "boolean")],
    ["display", optional(props.display, (value) => SCALE_DISPLAYS.some((one) => one === value))],
    ["minLabel", optional(props.minLabel, text)],
    ["maxLabel", optional(props.maxLabel, text)],
    ["unit", optional(props.unit, text)],
  ];
  const wrong = fields.find(([, ok]) => !ok);
  return wrong === undefined ? undefined : `${wrong[0]} is of the wrong type`;
};

/** The props as an agent's Scale, or an error naming the item and each problem. */
export const checkedScaleProps = (itemId: string, props: unknown): ScaleProps => {
  const shape = shapeProblem(props);
  const problems =
    shape === undefined
      ? scalePropsProblems(props).map(({ path, message }) => `${path}: ${message}`)
      : [shape];
  if (problems.length === 0) return props as ScaleProps;
  throw new Error(`the Scale "${itemId}" refuses its props: ${problems.join("; ")}`);
};
