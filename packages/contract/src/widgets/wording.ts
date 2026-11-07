// How a request's wording reads a widget item's props (widget-answers, design decision 4;
// widget-registry, design decision 5): the expected shape and the field list of each of a
// registered type's objects, from its entry, and a molecule reference's, keyed as `itemKey` keys
// them (`tree.props.nodes[].label`; `paths.ts` turns a path into such a key). The texts of the
// Tree and the Gantt are in their folders. Nothing here validates: the schemas and the widgets' own
// checks do, and this words their problems.

import { WIDGET_TYPES, type WidgetType } from "./registry.ts";

const MOLECULE_EXPECTED: Readonly<Record<string, string>> = {
  "molecule.props": "a reference's props {molecule, version?, data}",
  "molecule.props.molecule":
    "a molecule name: lowercase letters, digits and hyphens, starting with a letter, at most 64 characters",
  "molecule.props.version": "a semantic version major.minor.patch",
  "molecule.props.data": "an object holding the data the molecule's parameters describe",
};

const MOLECULE_FIELDS: Readonly<Record<string, string>> = {
  "molecule.props": "a reference's props hold only molecule, version and data",
};

/** The expected shapes of the widget items' fields of a registry's types and the molecule's. */
export const widgetExpected = (
  types: readonly WidgetType[] = WIDGET_TYPES,
): Readonly<Record<string, string>> =>
  Object.assign({}, ...types.map((entry) => entry.wording.expected), MOLECULE_EXPECTED);

/** What each of the widget items' objects holds, of a registry's types and the molecule's. */
export const widgetFields = (
  types: readonly WidgetType[] = WIDGET_TYPES,
): Readonly<Record<string, string>> =>
  Object.assign({}, ...types.map((entry) => entry.wording.fields), MOLECULE_FIELDS);

/** The expected shapes of a widget item's fields, by key. */
export const WIDGET_EXPECTED: Readonly<Record<string, string>> = widgetExpected();

/** What each of a widget item's objects holds, by key. */
export const WIDGET_FIELDS: Readonly<Record<string, string>> = widgetFields();
