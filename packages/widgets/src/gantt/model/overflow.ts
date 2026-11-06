// Whether the chart scrolls and to which side (review F-03; view spec, "Gantt overflow cue"): the
// sides of its frame that hold more, from the scroll box's measures, so that an edge shadow shows
// on each. A measure within a pixel of the edge is the edge: browsers round the scroll position.

export type OverflowEdges = { readonly before: boolean; readonly after: boolean };

export const overflowEdges = (
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
): OverflowEdges =>
  Object.freeze({
    before: scrollLeft > 1,
    after: scrollWidth - clientWidth - scrollLeft > 1,
  });
