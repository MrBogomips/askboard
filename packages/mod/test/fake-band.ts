// The band's elements as the fake `$.ui.resolve` hands them out, each a plain record, and a drawing
// read back as the rows a terminal shows: a column's children one under the other, a row's or a
// text's children on one line, a link as its address, or `[text](address)` when it has children or
// a label.
// What the plugins beneath draw, the fake `next`'s answer, reads as one row, `BENEATH_ROW`.

import type { BandElements, RenderChildren, RenderElement } from "../src/mod-api.ts";

type Drawn = {
  readonly type: "Box" | "Text" | "Link" | "Beneath";
  readonly props: {
    readonly children?: RenderChildren;
    readonly flexDirection?: string;
    readonly dimColor?: boolean;
    readonly color?: string;
    readonly wrap?: string;
    readonly href?: string;
    readonly label?: string;
  };
};

const element =
  (type: Drawn["type"]) =>
  (props: Drawn["props"]): RenderElement =>
    ({ type, props }) as unknown as RenderElement;

/** The constructors the fake `$.ui.resolve` hands out. */
export const FAKE_ELEMENTS: BandElements = {
  Box: element("Box"),
  Text: element("Text"),
  Link: element("Link"),
};

/** What the plugins beneath draw, as the fake `next` gives it. */
export const BENEATH: RenderElement = element("Beneath")({});

/** The row that stands for what the plugins beneath draw. */
export const BENEATH_ROW = "<beneath>";

/** An element of a drawing, to read its type and props. */
export const drawnOf = (node: RenderElement): Drawn => node as unknown as Drawn;

const childrenOf = (children: RenderChildren): readonly RenderChildren[] =>
  Array.isArray(children) ? children : [children];

const inline = (children: RenderChildren): string =>
  childrenOf(children)
    .map((child) => {
      if (child === undefined) return "";
      if (typeof child === "string") return child;
      if (Array.isArray(child)) return inline(child);
      const { type, props } = drawnOf(child as RenderElement);
      if (type === "Link") {
        const text = props.children === undefined ? props.label : inline(props.children);
        return text === undefined ? props.href : `[${text}](${props.href})`;
      }
      return type === "Beneath" ? BENEATH_ROW : inline(props.children);
    })
    .join("");

/** A drawing's rows, as a terminal shows them. */
export const rowsOf = (node: RenderElement): string[] => {
  const { type, props } = drawnOf(node);
  if (type === "Beneath") return [BENEATH_ROW];
  if (type !== "Box" || props.flexDirection !== "column") return [inline(node)];
  return childrenOf(props.children).flatMap((child) =>
    child === undefined || typeof child === "string" || Array.isArray(child)
      ? [inline(child)]
      : rowsOf(child as RenderElement),
  );
};
