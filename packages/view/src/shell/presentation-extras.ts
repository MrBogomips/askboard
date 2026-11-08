// The quick toggles' side of the view (settings-languages, design decision 10): the presentation
// the toggles read, from the `askboard-data` block and then from each update of the board page,
// and what a toggle asks for. A hosted view reports it to the board page, which applies it at once
// and answers with an update; a Snapshot has no board page, so its Theme and density toggles act
// on the view alone and save nothing, and it has no settings panel (snapshot-toolbar).

import type { Density, ThemePreference } from "@askboard/contract";
import type { BootData } from "../boot-data.ts";
import type { ViewMessage, ViewPresentation } from "../view-protocol.ts";
import type { ViewChannel } from "./channel.ts";
import { DEFAULT_PRESENTATION, type PresentationControls } from "./presentation-controls.ts";
import { createStore } from "./store.ts";

export type PresentationOptions = {
  readonly hosted: boolean;
  readonly report: (message: ViewMessage) => void;
  /** A Snapshot's Theme toggle: the view follows this preference itself. */
  readonly followTheme?: (preference: ThemePreference) => void;
  /** A Snapshot's density toggle: the page applies this density itself. */
  readonly followDensity?: (density: Density) => void;
  /** What a Snapshot starts in, from its record; the boot block's presentation otherwise. */
  readonly initial?: ViewPresentation;
};

const focusSettings = (): void => {
  document.querySelector<HTMLElement>("[data-askboard-settings]")?.focus();
};

export const startPresentation = (
  data: BootData,
  channel: ViewChannel,
  { hosted, report, followTheme, followDensity, initial }: PresentationOptions,
): PresentationControls => {
  const presentation = createStore(initial ?? data.presentation ?? DEFAULT_PRESENTATION);
  // The settings panel closing gives the focus back to "Settings", once for each closing.
  let closings = 0;
  channel.onUpdate((update) => {
    if (update.presentation !== undefined) presentation.set(update.presentation);
    if (update.settingsClosed !== undefined && update.settingsClosed > closings) {
      closings = update.settingsClosed;
      focusSettings();
    }
  });
  return {
    presentation,
    hosted,
    set: (setting) => {
      if (hosted) {
        report({ type: "setting", ...setting });
      } else if (setting.key === "theme") {
        followTheme?.(setting.value);
        presentation.set({ ...presentation.get(), theme: setting.value });
      } else if (setting.key === "density") {
        followDensity?.(setting.value);
        presentation.set({ ...presentation.get(), density: setting.value });
      }
    },
    openSettings: () => {
      if (hosted) report({ type: "open-settings" });
    },
  };
};
