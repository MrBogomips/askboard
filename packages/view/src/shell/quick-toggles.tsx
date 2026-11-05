// The quick toggles at the right end of header row 2 (DESIGN.md, Context header and Quick toggles;
// settings-languages, design decision 10): "Theme" with "System | Light | Dark", "Compact |
// Comfortable", then "Settings" after a separator. A toggle the project fixes is disabled, its
// description naming the file and the key. A Snapshot has no board page: its Theme toggle acts on
// the view alone, and density and "Settings" are not shown (E7).

import { useSyncExternalStore } from "react";
import { useStrings } from "../catalog/port.ts";
import { fixedBy, type PresentationControls } from "./presentation-controls.ts";
import { Segmented } from "./segmented.tsx";
import { BUTTON_SECONDARY, SEPARATOR } from "./styles.ts";

export const QuickToggles = ({ controls }: { readonly controls: PresentationControls }) => {
  const text = useStrings();
  const presentation = useSyncExternalStore(
    controls.presentation.subscribe,
    controls.presentation.get,
  );
  return (
    <>
      <span aria-hidden="true" className={SEPARATOR} />
      <span className="text-label text-muted-foreground uppercase">{text("toggles.theme")}</span>
      <Segmented
        label={text("toggles.theme")}
        segments={[
          { value: "system", label: text("toggles.system") },
          { value: "light", label: text("toggles.light") },
          { value: "dark", label: text("toggles.dark") },
        ]}
        value={presentation.theme}
        onChange={(value) => controls.set({ key: "theme", value })}
        description={fixedBy(presentation, "theme")}
      />
      {controls.hosted ? (
        <>
          <Segmented
            label={text("toggles.density")}
            segments={[
              { value: "compact", label: text("toggles.compact") },
              { value: "comfortable", label: text("toggles.comfortable") },
            ]}
            value={presentation.density}
            onChange={(value) => controls.set({ key: "density", value })}
            description={fixedBy(presentation, "density")}
          />
          <span aria-hidden="true" className={SEPARATOR} />
          <button
            type="button"
            data-askboard-settings=""
            className={BUTTON_SECONDARY}
            onClick={controls.openSettings}
          >
            {text("toggles.settings")}
          </button>
        </>
      ) : null}
    </>
  );
};
