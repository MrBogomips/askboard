// What a pointer drag holds and reports (latex-kanban-timeline, design decision 10): the press it
// follows and its travel from there, horizontal (`dx`) and vertical (`dy`). Plain data, so that
// the rules are tested without a DOM; the hook that captures the pointer is `pointer-drag.ts`.

/** What is being dragged, what the drag does, and the pointer's travel from the press so far. */
export type PointerDrag<Kind extends string> = {
  readonly id: string;
  readonly kind: Kind;
  readonly dx: number;
  readonly dy: number;
};

/** The press a drag follows: its element's ID, its kind, the pointer and where it went down. */
export type Held<Kind extends string> = {
  readonly id: string;
  readonly kind: Kind;
  readonly pointerId: number;
  readonly from: { readonly x: number; readonly y: number };
};

/** The drag at the pointer's position: its travel from where the press went down. */
export const dragOf = <Kind extends string>(
  held: Held<Kind>,
  to: { readonly x: number; readonly y: number },
): PointerDrag<Kind> => ({
  id: held.id,
  kind: held.kind,
  dx: to.x - held.from.x,
  dy: to.y - held.from.y,
});
