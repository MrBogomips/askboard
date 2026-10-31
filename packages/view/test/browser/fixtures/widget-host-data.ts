// What the widget host's page and its harness share (design decision 9): the id of the page's JSON
// data block, what the block holds, and the binding the page reports each view message through.

import type { BoardState } from "@askboard/contract";

/** The id of the `<script type="application/json">` element the host page reads. */
export const WIDGET_HOST_DATA_ID = "askboard-widget-host";

/** The binding Playwright installs and the host page passes every view message to. */
export const WIDGET_HOST_BINDING = "__askboardWidgetHostMessage";

export type WidgetHostData = {
  /** The view's srcdoc, assembled from the build for the test's board document. */
  readonly srcdoc: string;
  /** The board state the host sends the view once, with the question open. */
  readonly state: BoardState;
};
