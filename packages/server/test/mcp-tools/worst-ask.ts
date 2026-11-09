import { GANTT_MAX_PREDECESSORS, GANTT_MAX_TASKS, POINTER_MAX_CHARS } from "@askboard/contract";
import { AskCore, type SourceFiles } from "@askboard/core";
import { LINK, runtimeClock } from "./helpers.ts";

// The worst ask the contract admits (result-bound, mcp-adapter spec: "The worst ask the contract
// admits", "The same on update"; Refs #98): a Gantt plan whose every task names 50 predecessors that
// are no task, and 200 excerpts and images whose pointers are 1,024 characters that JSON escapes.

const id = (kind: string, n: number) => `${kind}${String(n).padStart(64 - kind.length, "0")}`;

/** The Tree and the Gantt of the worst plan: every Gantt task names `GANTT_MAX_PREDECESSORS` unknown tasks. */
export const worstPlanItems = (): readonly unknown[] => {
  const columns = ["optimistic", "mostLikely", "pessimistic"].map((field) => ({
    field,
    label: field,
    type: "number",
  }));
  const leaves = Array.from({ length: GANTT_MAX_TASKS }, (_, n) => id("l", n));
  return [
    {
      type: "tree",
      id: "wbs",
      props: {
        pert: true,
        columns,
        nodes: leaves.map((leaf) => ({
          id: leaf,
          label: "Leaf",
          optimistic: 1,
          mostLikely: 2,
          pessimistic: 3,
        })),
      },
    },
    {
      type: "gantt",
      id: "schedule",
      props: {
        workPackages: "wbs",
        start: "2026-11-02",
        tasks: Object.fromEntries(
          leaves.map((leaf, n) => [
            leaf,
            {
              dependencies: Array.from({ length: GANTT_MAX_PREDECESSORS }, (_, k) =>
                id("p", n * GANTT_MAX_PREDECESSORS + k),
              ),
            },
          ]),
        ),
      },
    },
  ];
};

/** A pointer of `POINTER_MAX_CHARS` characters, each a control character JSON writes as `\u00XX`. */
export const escapedPointer = (n: number): string =>
  `${n}`.padEnd(POINTER_MAX_CHARS, String.fromCharCode(1));

/** 100 excerpts and 100 images, each with an escaped pointer of its own. */
export const worstPointerItems = (): readonly unknown[] =>
  Array.from({ length: 200 }, (_, n) =>
    n % 2 === 0
      ? { type: "excerpt", id: id("x", n), props: { pointer: escapedPointer(n) } }
      : { type: "image", id: id("i", n), props: { pointer: escapedPointer(n), alt: "Shot" } },
  );

const unreadable = async () => ({
  status: "unresolved" as const,
  reason: "invalid-pointer" as const,
});

/** The port's other reads, which an ask with pointer items never makes. */
const unused = (async () => undefined) as never;

/**
 * Every pointer leads nowhere: the port answers `invalid-pointer`, as for a pointer it cannot read.
 */
export const unreadableSources: SourceFiles = {
  resolveExcerpt: unreadable,
  resolveImage: unreadable,
  resolveReference: unused,
  sourceState: unused,
  readSource: unused,
  editorTarget: unused,
};

/** A real `AskCore` over `unreadableSources`, with a project folder so that the pointers are looked up. */
export const worstCore = (): AskCore =>
  new AskCore({
    randomness: { bytes: (count) => crypto.getRandomValues(new Uint8Array(count)) },
    showing: { check: async () => ({ showable: true }), open: () => undefined },
    address: { link: async () => LINK },
    identity: { gitUserName: async () => undefined, loginName: async () => "paola" },
    report: () => undefined,
    clock: runtimeClock,
    sources: unreadableSources,
    projectRoot: "/home/paola/orders",
  });
