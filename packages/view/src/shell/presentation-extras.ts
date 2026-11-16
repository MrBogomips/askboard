// The quick toggles' side of the view (settings-languages, design decision 10): the presentation
// the toggles read, from the `askboard-data` block and then from each update of the board page,
// and what a toggle asks for. A hosted view reports it to the board page, which applies it at once
// and answers with an update; a Snapshot has no board page, so its Theme and density toggles act
// on the view alone and save nothing, and it has no settings panel (snapshot-toolbar).

import type { Density, Palette, ThemePreference } from "@askboard/contract";
import type { BootData } from "../boot-data.ts";
import type { ReferenceInset, ViewMessage, ViewPresentation } from "../view-protocol.ts";
import type { ViewChannel } from "./channel.ts";
import { measureInset } from "./measure-inset.ts";
import { DEFAULT_PRESENTATION, type PresentationControls } from "./presentation-controls.ts";
import { createStore, type Store } from "./store.ts";

export type PresentationOptions = {
  readonly hosted: boolean;
  readonly report: (message: ViewMessage) => void;
  /** A Snapshot's Theme toggle: the view follows this preference itself. */
  readonly followTheme?: (preference: ThemePreference) => void;
  /** A Snapshot's density toggle: the page applies this density itself. */
  readonly followDensity?: (density: Density) => void;
  /** The palette in use, which the view's follower keeps; the presentation's palette otherwise. */
  readonly resolvedPalette?: Store<Palette>;
  /** What a Snapshot starts in, from its record; the boot block's presentation otherwise. */
  readonly initial?: ViewPresentation;
  /** Where the settings sheet sits, measured as for the reading panel (design decision 12). */
  readonly inset?: () => ReferenceInset;
};

const focusSettings = (): void => {
  document.querySelector<HTMLElement>("[data-askboard-settings]")?.focus();
};

export const startPresentation = (
  data: BootData,
  channel: ViewChannel,
  {
    hosted,
    report,
    followTheme,
    followDensity,
    resolvedPalette: given,
    initial,
    inset = measureInset,
  }: PresentationOptions,
): PresentationControls => {
  const presentation = createStore(initial ?? data.presentation ?? DEFAULT_PRESENTATION);
  const resolvedPalette = given ?? createStore<Palette>(presentation.get().palette);
  if (given === undefined) {
    presentation.subscribe(() => resolvedPalette.set(presentation.get().palette));
  }
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
    resolvedPalette,
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
      // A Snapshot carries one palette and has no row to pick another.
    },
    openSettings: () => {
      if (hosted) report({ type: "open-settings", inset: inset() });
    },
  };
};
