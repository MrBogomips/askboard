// A Diagram in a Snapshot that carries its renders instead of a renderer (design decision 5,
// task 5.2): the light and the dark SVG text the view rendered, as data. The `.dark` class picks
// one, and it shows as a `blob:` image like any other diagram. `assemble` swaps a diagram item
// for this type when it is given the renders. There is no hit map: a Snapshot takes no
// annotation, and pins on it would need the hit map stored with the render.

import { type ItemProps, register } from "../port/index.ts";
import { type DiagramEngine, DiagramView } from "./_diagram.tsx";

const engine: DiagramEngine = {
  name: "svg",
  render: async (_source, { theme, props }) => {
    const svg = (props.svg as Record<string, unknown> | undefined)?.[theme];
    if (typeof svg !== "string") throw new Error(`no ${theme} render in this Snapshot`);
    return svg;
  },
  anchors: () => [],
};

const DiagramSvg = (props: ItemProps) => <DiagramView {...props} engine={engine} />;

register("DiagramSvg", DiagramSvg);
