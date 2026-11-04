// The context chunk (excerpts, design decision 6; proposal B14): it registers the three context
// items' components, `excerpt`, `reference` and `image`, through the `CatalogRenderer` port. The
// view hands an item's props over as data, unchecked, so each component reads only string fields
// and shows them as text, never as markup (AD-8). Each reports ready once laid out.

import { type ItemProps, register, useReadyAfterLayout } from "../port.ts";

/** A context item as the view hands it over, its props not checked yet. */
type ContextItem = { readonly type: string; readonly id: string; readonly props: unknown };

type ContextProps = ItemProps<ContextItem>;

/** The props' string field `name`, or undefined. */
const field = (props: unknown, name: string): string | undefined => {
  if (typeof props !== "object" || props === null || !Object.hasOwn(props, name)) return undefined;
  const value = (props as Record<string, unknown>)[name];
  return typeof value === "string" ? value : undefined;
};

/** The first of the props' string fields `names` that is set, or the empty string. */
const firstOf = (props: unknown, names: readonly string[]): string =>
  names.map((name) => field(props, name)).find((value) => value !== undefined) ?? "";

const Excerpt = ({ item, ready }: ContextProps) => {
  useReadyAfterLayout(ready);
  return <pre data-context="excerpt">{firstOf(item.props, ["text", "pointer"])}</pre>;
};

const Reference = ({ item, ready }: ContextProps) => {
  useReadyAfterLayout(ready);
  return <p data-context="reference">{firstOf(item.props, ["title", "pointer", "url"])}</p>;
};

const Image = ({ item, ready }: ContextProps) => {
  useReadyAfterLayout(ready);
  return <p data-context="image">{firstOf(item.props, ["alt", "pointer"])}</p>;
};

register("excerpt", Excerpt);
register("reference", Reference);
register("image", Image);
