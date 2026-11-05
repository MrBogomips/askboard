// Where a question's context goes (settings-languages, design decision 1, task 8.5): the board's
// default is the presentation's `contextPlacement`, which the user's settings give and the settings
// panel changes; a question's own control overrides it on that question only. The excerpts' epic
// (E5) reads this seam when it lands: until then the view holds the default and nothing shows it.

import type { ContextPlacement } from "@askboard/contract";
import type { ViewPresentation } from "../view-protocol.ts";

/** The placement of one question's context: its own override, else the board's default. */
export const placementOf = (
  presentation: Pick<ViewPresentation, "contextPlacement">,
  override?: ContextPlacement,
): ContextPlacement => override ?? presentation.contextPlacement;
