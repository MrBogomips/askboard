// What the four layouts share (layouts, design decisions 1 and 3): the reference to the union of
// items their props hold, the shape of one such item and the wording of their `type` fields. Plain
// ECMAScript with no JSON and no Ajv: a view chunk may import it.

/** The name of the union in the question props' `$defs`, composed over the registry. */
export const LAYOUT_ITEM_DEFINITION = "layoutItem";

/**
 * Where a layout's props find the items they hold: every registered type's item, layouts
 * included, as the input format writes them.
 */
export const LAYOUT_ITEM_REF = `urn:askboard:input:question-props#/$defs/${LAYOUT_ITEM_DEFINITION}`;

/** An item a layout holds: an atom, a widget or another layout. */
export type LayoutChild = {
  readonly type: string;
  readonly id: string;
  readonly props: unknown;
};

/** What a layout's `type` field says of the items it holds, for the wording of a refusal. */
export const LAYOUT_CHILD_TYPE =
  "the type of an atom, a widget or a layout; an excerpt, a reference, an image or a molecule reference belongs in the question's own items, outside layouts";

/** What a layout's item list says of its items. */
export const LAYOUT_CHILD_ITEM = "an item {type, id, props}: an atom, a widget or a layout";

/** What each item a layout holds is made of. */
export const LAYOUT_CHILD_FIELDS = "an item holds only type, id and props";

/** The checks of a layout whose schema says all of its rules. */
export const noPropsProblems = (): readonly never[] => [];
