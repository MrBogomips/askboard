// The PlantUML Diagram with Graphviz: Viz.js 3.24.0 from the tarball's `viz-global.js`, handed to
// the engine through `PLANTUML_VIZ`. Bundled, the UMD attaches `Viz` to its exports, not to the
// global (the package README). Graphviz runs as WebAssembly (D6).

import Viz from "@plantuml/core/viz-global.js";
import { type ItemProps, register } from "../port/index.ts";
import { DiagramView } from "./_diagram.tsx";
import { plantumlEngine } from "./_plantuml.tsx";

const engine = plantumlEngine("plantuml", Viz);

const PlantUML = (props: ItemProps) => <DiagramView {...props} engine={engine} />;

register("PlantUML", PlantUML);
