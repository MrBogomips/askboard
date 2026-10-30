import dagre from "@dagrejs/dagre";
import { type Edge, type Node, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo, useState } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

type GraphNode = { id: string; label: string };
type GraphEdge = { from: string; to: string };

const WIDTH = 140;
const HEIGHT = 40;

// Layout with dagre, left to right; xyflow draws it. Positions are computed from the item alone,
// so two renders give the same picture.
const layout = (nodes: GraphNode[], edges: GraphEdge[]): { nodes: Node[]; edges: Edge[] } => {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", nodesep: 24, ranksep: 48 });
  graph.setDefaultEdgeLabel(() => ({}));
  for (const node of nodes) graph.setNode(node.id, { width: WIDTH, height: HEIGHT });
  for (const edge of edges) graph.setEdge(edge.from, edge.to);
  dagre.layout(graph);
  return {
    nodes: nodes.map((node) => {
      const { x, y } = graph.node(node.id);
      return { id: node.id, data: { label: node.label }, position: { x: x - WIDTH / 2, y: y - HEIGHT / 2 } };
    }),
    edges: edges.map((edge) => ({ id: `${edge.from}-${edge.to}`, source: edge.from, target: edge.to })),
  };
};

// Graph (EXPERIENCE.md, Components) on xyflow with dagre. Selecting a node is the item's value
// in the draft record. Ready once xyflow has measured the nodes and fitted the view.
const Graph = ({ item, draft, emit, ready }: ItemProps) => {
  const [done, setDone] = useState(false);
  const nodes = Array.isArray(item.props?.nodes) ? (item.props.nodes as GraphNode[]) : [];
  const edges = Array.isArray(item.props?.edges) ? (item.props.edges as GraphEdge[]) : [];
  const laid = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const shown = laid.nodes.map((node) => ({ ...node, selected: node.id === draft }));
  useReadyAfterLayout(ready, done);
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-label uppercase text-muted-foreground">{text(item.props?.label)}</figcaption>
      <div className="h-72 w-[640px] rounded-md border border-border bg-card" data-graph={item.id}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={shown}
            edges={laid.edges}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            onInit={() => requestAnimationFrame(() => setDone(true))}
            onNodeClick={(_, node) => emit({ type: "draft.set", id: item.id, value: node.id })}
          />
        </ReactFlowProvider>
      </div>
    </figure>
  );
};

register("Graph", Graph);
