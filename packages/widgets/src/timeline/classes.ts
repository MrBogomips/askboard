// The Timeline's classes (DESIGN.md: Timeline, Widget frame, Change highlight, Focus ring), from the
// design tokens as the Gantt's and the Ranking's are. Every class is written out in full, so that
// Tailwind finds it in the chunk's own sources, and no element takes a `style` attribute (AD-8);
// geometry is written as SVG attributes. The frame and the toolbar are the shared ones
// (`shared/move-classes.ts`).

/** The width of the fixed column of lane labels, in px. */
export const LANE_COLUMN_WIDTH = 120;

/** The body: the lane labels at the left, the chart in a region that scrolls sideways. */
export const BODY = "flex";

/** The lane labels' drawing, beside the chart and not scrolling with it. */
export const LANES = "block shrink-0 border-r border-border select-none";

/** The chart's region; it keeps out of the Tab order, so that the entries are the one stop. */
export const SCROLLER = "min-w-0 flex-1 overflow-x-auto outline-none";

/** The chart's drawing: pointer drags are the entries', so the browser takes no touch scroll. */
export const CHART = "block touch-none select-none";

/** A lane's label in `typography.label`. */
export const LANE_LABEL = "fill-foreground text-label";

/** An entry, which draws its own ring: no browser outline. */
export const ENTRY = "outline-none";

/** The grab cursor while the Timeline can change. */
export const ENTRY_GRAB = "cursor-grab";

/** A range: a `gantt-bar` bar. */
export const RANGE = "fill-gantt-bar";

/** A milestone: a diamond in `foreground`. */
export const MILESTONE = "fill-foreground";

/** An entry's label in `typography.badge`, after its shape or inside a range that holds it. */
export const ENTRY_LABEL = "pointer-events-none fill-foreground text-badge";

/** A moved entry's outline, `gantt-user-change`: 2px in `change`, offset by 1px. */
export const CHANGE_OUTLINE = "pointer-events-none fill-none stroke-change stroke-2";

/** The current entry's ring, `focus-ring`. */
export const CURRENT_RING = "pointer-events-none fill-none stroke-ring stroke-2";
