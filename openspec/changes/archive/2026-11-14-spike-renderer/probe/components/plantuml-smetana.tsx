// The PlantUML Diagram without Graphviz: no `viz-global.js` in the chunk, so diagrams that need
// Graphviz use the Smetana layout engine (D6), and no WebAssembly runs.

import { type ItemProps, register } from "../port/index.ts";
import { DiagramView } from "./_diagram.tsx";
import { plantumlEngine } from "./_plantuml.tsx";

const engine = plantumlEngine("plantuml-smetana", null);

const PlantUMLSmetana = (props: ItemProps) => <DiagramView {...props} engine={engine} />;

register("PlantUMLSmetana", PlantUMLSmetana);
