// "Theme" in the ask row (answering-flow-visual, design decision 1; DESIGN.md, Quick toggles): an
// icon button named by `toggles.theme` that opens a non-modal popover holding the Theme and
// Density controls, which act as the quick toggles always did, read-only states and Snapshot
// handling included (settings-languages, design decision 10).

import { PALETTES, type PresentationKey } from "@askboard/contract";
import { Popover } from "radix-ui";
import { useSyncExternalStore } from "react";
import { useStrings } from "../catalog/port.ts";
import { IconTheme } from "../icons/index.ts";
import type { StringKey } from "../strings/index.ts";
import type { ViewPresentation } from "../view-protocol.ts";
import { fixedBy, type PresentationControls } from "./presentation-controls.ts";
import { Segmented } from "./segmented.tsx";
import { BUTTON_ICON, SECTION_LABEL } from "./styles.ts";

// A project file fixes a key for a board; a Snapshot is a file of its own, which no setting reaches.
const fixedIn = (
  controls: PresentationControls,
  presentation: ViewPresentation,
  key: PresentationKey,
): string | undefined => (controls.hosted ? fixedBy(presentation, key) : undefined);

const POPOVER =
  "z-30 flex w-[26rem] max-w-[90vw] flex-col gap-sm rounded-md border border-border bg-popover p-sm text-body text-popover-foreground shadow-md";

// The palette names, the same in both languages (palettes, design decision D6).
const PALETTE_LABELS = {
  carta: "toggles.paletteCarta",
  nordico: "toggles.paletteNordico",
  grafite: "toggles.paletteGrafite",
  contrasto: "toggles.paletteContrasto",
} as const satisfies Record<(typeof PALETTES)[number], StringKey>;

/** The three controls: Theme, Density and, on a board, Palette with its note when the system's contrast is in use. */
export const QuickToggles = ({ controls }: { readonly controls: PresentationControls }) => {
  const text = useStrings();
  const presentation = useSyncExternalStore(
    controls.presentation.subscribe,
    controls.presentation.get,
    controls.presentation.get,
  );
  const inUse = useSyncExternalStore(
    controls.resolvedPalette.subscribe,
    controls.resolvedPalette.get,
    controls.resolvedPalette.get,
  );
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className={SECTION_LABEL}>{text("toggles.theme")}</span>
        <Segmented
          label={text("toggles.theme")}
          segments={[
            { value: "system", label: text("toggles.system") },
            { value: "light", label: text("toggles.light") },
            { value: "dark", label: text("toggles.dark") },
          ]}
          value={presentation.theme}
          onChange={(value) => controls.set({ key: "theme", value })}
          description={fixedIn(controls, presentation, "theme")}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className={SECTION_LABEL}>{text("toggles.density")}</span>
        <Segmented
          label={text("toggles.density")}
          segments={[
            { value: "compact", label: text("toggles.compact") },
            { value: "comfortable", label: text("toggles.comfortable") },
          ]}
          value={presentation.density}
          onChange={(value) => controls.set({ key: "density", value })}
          description={fixedIn(controls, presentation, "density")}
        />
      </div>
      {controls.hosted ? (
        <div data-askboard-palette="" className="flex flex-col gap-1">
          <span className={SECTION_LABEL}>{text("toggles.palette")}</span>
          <Segmented
            label={text("toggles.palette")}
            segments={PALETTES.map((value) => ({ value, label: text(PALETTE_LABELS[value]) }))}
            value={presentation.palette}
            onChange={(value) => controls.set({ key: "palette", value })}
            description={fixedIn(controls, presentation, "palette")}
          />
          {inUse !== presentation.palette ? (
            <p data-askboard-palette-note="" className="text-badge text-muted-foreground">
              {text("toggles.paletteSystemContrast")}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

export const ThemeControl = ({ controls }: { readonly controls: PresentationControls }) => {
  const text = useStrings();
  return (
    <Popover.Root modal={false}>
      <Popover.Trigger
        data-askboard-theme=""
        aria-label={text("toggles.theme")}
        title={text("toggles.theme")}
        className={BUTTON_ICON}
      >
        <IconTheme className="size-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={text("toggles.theme")}
          side="bottom"
          align="end"
          sideOffset={4}
          className={POPOVER}
        >
          <QuickToggles controls={controls} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};
