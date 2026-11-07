// The Timeline's fixed column of lane labels (view-and-widgets spec: Timeline layout; DESIGN.md:
// Timeline): a band at the top as high as the axis, then each lane's label in `typography.label`,
// cut with an ellipsis and whole in its title, and a line under each lane. It draws beside the
// chart and does not scroll with it. The labels are the agent's content, shown as text (AD-8); the
// column is hidden from assistive technology, since each entry's name holds its lane.

import { memo } from "react";
import { LANE_COLUMN_WIDTH, LANE_LABEL, LANES } from "./classes.ts";
import type { TimelineLayout } from "./layout.ts";
import { laneText } from "./text.ts";

const LABEL_X = 8;

export const LaneLabels = memo(({ layout }: { readonly layout: TimelineLayout }) => (
  <svg
    aria-hidden="true"
    data-timeline-lanes=""
    width={LANE_COLUMN_WIDTH}
    height={layout.height}
    viewBox={`0 0 ${LANE_COLUMN_WIDTH} ${layout.height}`}
    className={LANES}
  >
    <rect x={0} y={0} width={LANE_COLUMN_WIDTH} height={layout.axis} className="fill-muted" />
    <line
      x1={0}
      y1={layout.axis - 0.5}
      x2={LANE_COLUMN_WIDTH}
      y2={layout.axis - 0.5}
      className="stroke-border stroke-1"
    />
    {layout.lanes.map((lane) => (
      <g key={lane.id}>
        <text
          data-timeline-lane-label={lane.id}
          x={LABEL_X}
          y={lane.top + lane.height / 2}
          dominantBaseline="central"
          className={LANE_LABEL}
        >
          {laneText(lane.label)}
          <title>{lane.label}</title>
        </text>
        <line
          x1={0}
          y1={lane.top + lane.height - 0.5}
          x2={LANE_COLUMN_WIDTH}
          y2={lane.top + lane.height - 0.5}
          className="stroke-border stroke-1"
        />
      </g>
    ))}
  </svg>
));
