// What the atoms' component tests share (atoms, group 5): an item drawn by the server renderer with
// the port's props, as the renderer hands them, and the calls the component made back. Not a test
// file; it holds no `test`.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  type CatalogComponent,
  type ItemProps,
  LanguageContext,
  LocaleContext,
} from "../../src/catalog/port.ts";

Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

const NONE = () => {};

export type Drawn = {
  readonly html: string;
  /** The props the component was given, whose callbacks record into `results` and `entries`. */
  readonly props: ItemProps;
  readonly results: unknown[];
  readonly entries: unknown[];
};

export type DrawOptions = {
  readonly result?: unknown;
  readonly entry?: string;
  readonly disabled?: boolean;
  readonly locale?: "en-US" | "it-IT";
  readonly id?: string;
};

/** The item drawn, and what its callbacks would have been given (none, as nothing is pressed). */
export const draw = (
  component: CatalogComponent | undefined,
  type: string,
  props: unknown,
  options: DrawOptions = {},
): Drawn => {
  if (component === undefined) throw new Error(`no ${type} chunk registered`);
  const results: unknown[] = [];
  const entries: unknown[] = [];
  const locale = options.locale ?? "en-US";
  const given: ItemProps = {
    item: { type, id: options.id ?? "atom", props },
    questionId: "q",
    value: undefined,
    onValueChange: NONE,
    onValuesChange: NONE,
    result: options.result,
    onResultChange: (next) => results.push(next),
    disabled: options.disabled ?? false,
    ready: NONE,
    board: { items: [], draft: new Map(), shown: new Map() },
    onDerived: NONE,
    entry: options.entry,
    onEntryChange: (next) => entries.push(next),
    cellEntries: new Map(),
    onCellEntriesChange: NONE,
  };
  const html = renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: locale },
      createElement(
        LocaleContext.Provider,
        { value: locale },
        createElement(component as never, given),
      ),
    ),
  );
  return { html, props: given, results, entries };
};
