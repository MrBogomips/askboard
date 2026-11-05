// The Theme control of an opened Snapshot (DESIGN.md, Quick toggles; snapshot design decision 9,
// open question B11): "System | Light | Dark" after a "Theme" label, in header row 2's right side.
// It sets the `.dark` class and saves nothing; the E8 quick toggles are not on `main` yet.

import { useSyncExternalStore } from "react";
import type { Store } from "./store.ts";
import { FOCUS_RING } from "./styles.ts";

/** What the control offers: the system's theme, or one fixed. */
export type ThemeChoice = "system" | "light" | "dark";

const CHOICES: readonly (readonly [ThemeChoice, string])[] = [
  ["system", "System"],
  ["light", "Light"],
  ["dark", "Dark"],
];

const SEGMENT = `px-2 py-0.5 text-control text-foreground-secondary aria-pressed:bg-muted aria-pressed:font-semibold aria-pressed:text-foreground ${FOCUS_RING}`;

export const ThemeControl = ({ choice }: { readonly choice: Store<ThemeChoice> }) => {
  const current = useSyncExternalStore(choice.subscribe, choice.get);
  return (
    <span className="flex items-center gap-2">
      <span className="text-label text-muted-foreground uppercase">Theme</span>
      <fieldset
        aria-label="Theme"
        className="m-0 flex min-w-0 divide-x divide-border overflow-hidden rounded-md border border-border p-0"
      >
        {CHOICES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={current === value}
            className={SEGMENT}
            onClick={() => choice.set(value)}
          >
            {label}
          </button>
        ))}
      </fieldset>
    </span>
  );
};
