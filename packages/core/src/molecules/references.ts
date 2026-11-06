// The molecule references an ask holds, as the agent sent them (widget-answers design decision 5):
// the board document keeps only their expanded items, so a later `change` of a reference merges
// into the props kept here and expands the whole again. Plain ECMAScript (AD-1).

type Json = Readonly<Record<string, unknown>>;

/** Each reference's props (`molecule`, `data`, and what else it holds), by the reference's ID. */
export type References = ReadonlyMap<string, Json>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const itemsOf = (item: unknown, type: string): readonly unknown[] =>
  isObject(item) && item.type === type && isObject(item.props) && Array.isArray(item.props.items)
    ? item.props.items
    : [];

/** The references among the items of the questions of `items`, at the top level or in an area. */
export const referencesIn = (items: readonly unknown[]): Map<string, Json> => {
  const found = new Map<string, Json>();
  const questions = items.flatMap((item) =>
    isObject(item) && item.type === "area" ? itemsOf(item, "area") : [item],
  );
  for (const question of questions) {
    for (const child of itemsOf(question, "question")) {
      if (isObject(child) && child.type === "molecule" && typeof child.id === "string") {
        found.set(child.id, isObject(child.props) ? child.props : {});
      }
    }
  }
  return found;
};
