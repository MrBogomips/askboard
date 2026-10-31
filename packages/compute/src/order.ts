// Evaluation order and cycle detection, shared by the graph and the engine: Tarjan's strongly
// connected components, written iteratively so a 10,000-node chain cannot overflow the stack.
// Edges go from a node to the nodes it reads, so components come out dependencies first.

export type Ordering = {
  /** Every node, dependencies before dependents. */
  readonly order: Int32Array;
  /** 1 for a node on a cycle: in a component of two or more, or reading itself. */
  readonly onCycle: Uint8Array;
};

export const orderNodes = (reads: readonly (readonly number[])[]): Ordering => {
  const n = reads.length;
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const onCycle = new Uint8Array(n);
  const order = new Int32Array(n);
  const stack: number[] = [];
  const frames: [node: number, edge: number][] = [];
  let counter = 0;
  let emitted = 0;

  const close = (v: number): void => {
    const component: number[] = [];
    for (let w = stack.pop() as number; ; w = stack.pop() as number) {
      onStack[w] = 0;
      component.push(w);
      if (w === v) break;
    }
    if (component.length > 1) for (const w of component) onCycle[w] = 1;
    for (const w of component) order[emitted++] = w;
  };

  for (let root = 0; root < n; root++) {
    if (index[root] !== -1) continue;
    frames.push([root, 0]);
    while (frames.length > 0) {
      const frame = frames[frames.length - 1] as [number, number];
      const [v, i] = frame;
      if (i === 0) {
        index[v] = low[v] = counter++;
        stack.push(v);
        onStack[v] = 1;
      }
      const edges = reads[v] ?? [];
      if (i < edges.length) {
        frame[1] = i + 1;
        const w = edges[i] as number;
        if (w === v) onCycle[v] = 1;
        if (index[w] === -1) frames.push([w, 0]);
        else if (onStack[w]) low[v] = Math.min(low[v] as number, index[w] as number);
        continue;
      }
      frames.pop();
      const parent = frames[frames.length - 1];
      if (parent) low[parent[0]] = Math.min(low[parent[0]] as number, low[v] as number);
      if (low[v] === index[v]) close(v);
    }
  }
  return { order, onCycle };
};
