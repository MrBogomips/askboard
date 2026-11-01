// What the widget host's page and its harness share (design decision 9): the id of the page's JSON
// data block, what the block holds, the binding the page reports each view message through, and
// the function a test sends the view a later update through.

import type { BoardState } from "@askboard/contract";

/** The id of the `<script type="application/json">` element the host page reads. */
export const WIDGET_HOST_DATA_ID = "askboard-widget-host";

/** The binding Playwright installs and the host page passes every view message to. */
export const WIDGET_HOST_BINDING = "__askboardWidgetHostMessage";

/** The function the host page sets on its window, which sends the view a later update. */
export const WIDGET_HOST_UPDATE = "__askboardWidgetHostUpdate";

export type WidgetHostData = {
  /** The view's srcdoc, assembled from the build for the test's board document. */
  readonly srcdoc: string;
  /** The board state the host sends the view once, with the question open. */
  readonly state: BoardState;
};
