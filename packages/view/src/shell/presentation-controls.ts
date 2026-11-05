// What the context header's quick toggles read and do (settings-languages, design decision 10): the
// presentation in effect, whether a board page hosts the view, and the two things the toggles can
// ask for: a new value, and the settings panel. The view builds it in `index.tsx` from the boot
// data and the board page's updates; a Snapshot, with no board page, has no density or panel and
// saves nothing (E7).

import {
  ASKBOARD_FOLDER,
  type PresentationKey,
  type PresentationSetting,
} from "@askboard/contract";
import type { ViewPresentation } from "../view-protocol.ts";
import type { Store } from "./store.ts";

export type PresentationControls = {
  readonly presentation: Store<ViewPresentation>;
  /** Whether a board page hosts the view: false in a Snapshot. */
  readonly hosted: boolean;
  /** A toggle's new value: sent to the board page, or, in a Snapshot, applied here only. */
  readonly set: (setting: PresentationSetting) => void;
  /** "Settings": the board page opens its panel. */
  readonly openSettings: () => void;
};

/** What a view shows before the board page has told it anything. */
export const DEFAULT_PRESENTATION: ViewPresentation = {
  theme: "system",
  density: "compact",
  contextPlacement: "beside",
  locked: [],
};

/** The project file and key that fix a key, for the toggle's description; undefined when free. */
export const fixedBy = (
  presentation: ViewPresentation,
  key: PresentationKey,
): string | undefined =>
  presentation.locked.includes(key) ? `${ASKBOARD_FOLDER}/config.json · ${key}` : undefined;
