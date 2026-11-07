// The Divider's check (atoms, design decision 1): its props hold nothing, restated plain for the
// component. Plain ECMAScript with no JSON and no Ajv. Nothing here throws on a value it cannot
// read; it gives a problem for it.

import { isRecord } from "../../problems.ts";
import type { Problem } from "../../validate.ts";

/** What is wrong with a Divider's props: anything but an empty object. */
export const dividerPropsProblems = (props: unknown): readonly Problem[] => {
  if (!isRecord(props)) return [{ path: "/", message: "a Divider's props are an empty object {}" }];
  return Object.keys(props).map((key) => ({
    path: `/${key}`,
    message: `unknown field "${key}"`,
  }));
};
