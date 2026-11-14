// The generated board of design decision 3: a WBS with PERT fields and roll-ups and a Gantt
// plan chaining its work packages, seeded so every run builds the same board. The default
// size gives about 1,000 graph nodes; `leaves` scales it (200 leaves is about 2,900 nodes).

import type { BoardDocument, WbsNode } from "../src/graph.ts";

export interface GenerateOptions {
  readonly seed?: number;
  /** Work packages with estimates; they sit in groups of eight under four phases. */
  readonly leaves?: number;
}

export const DEFAULT_LEAVES = 64;

/** mulberry32: small, fast and the same in every runtime. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateBoard(options: GenerateOptions = {}): BoardDocument {
  const rnd = random(options.seed ?? 20261030);
  const leafCount = options.leaves ?? DEFAULT_LEAVES;
  const int = (lo: number, hi: number): number => lo + Math.floor(rnd() * (hi - lo + 1));
  const leafIds: string[] = [];
  const phases: WbsNode[] = [];
  const groupSize = 8;
  const groups = Math.ceil(leafCount / groupSize);
  const groupsPerPhase = Math.ceil(groups / 4);
  let made = 0;
  for (let p = 0; p < 4 && made < leafCount; p++) {
    const groupNodes: WbsNode[] = [];
    for (let g = 0; g < groupsPerPhase && made < leafCount; g++) {
      const leaves: WbsNode[] = [];
      for (let l = 0; l < groupSize && made < leafCount; l++) {
        const optimistic = int(1, 5);
        const mostLikely = optimistic + int(0, 6);
        const pessimistic = mostLikely + int(1, 10);
        const id = `wp-${made}`;
        leafIds.push(id);
        leaves.push({ id, optimistic, mostLikely, pessimistic });
        made++;
      }
      groupNodes.push({ id: `g-${p}-${g}`, children: leaves });
    }
    phases.push({ id: `phase-${p}`, children: groupNodes });
  }
  // A chain through every work package, plus a seeded cross-link now and then.
  const dependencies: Record<string, string[]> = {};
  for (let i = 1; i < leafIds.length; i++) {
    const preds = [leafIds[i - 1] as string];
    if (i > 8 && rnd() < 0.25) preds.push(leafIds[int(0, i - 8)] as string);
    dependencies[leafIds[i] as string] = preds;
  }
  return {
    items: [
      {
        type: "question",
        id: "plan",
        props: {
          items: [
            { type: "molecule", id: "gen", props: { molecule: "wbs-pert", data: { nodes: phases } } },
            { type: "molecule", id: "genplan", props: { molecule: "gantt-plan", data: { workPackages: "gen", start: "2026-11-02", dependencies } } },
          ],
        },
      },
    ],
  };
}

/** The input the latency run edits: the first work package's pessimistic estimate, so the whole chain recomputes. */
export const EDIT_ADDRESS = "gen.phase-0.g-0-0.wp-0.pessimistic";
/** A node to read after each edit, so a lazy engine must finish the work. */
export const EDIT_PROBE = "genplan.finishDate";
