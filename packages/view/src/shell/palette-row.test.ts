import { describe, expect, test } from "bun:test";
import type { Palette } from "@askboard/contract";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "../catalog/port.ts";
import type { ViewPresentation } from "../view-protocol.ts";
import { DEFAULT_PRESENTATION, type PresentationControls } from "./presentation-controls.ts";
import { createStore } from "./store.ts";
import { QuickToggles } from "./theme-control.tsx";

// The palette row in the Theme popover (palettes, task 3.4, design decision D6): a third Segmented
// after Density, hooked `data-askboard-palette`, read-only when the project sets the key, with a
// note under it while the palette in use is not the chosen one, and absent in a Snapshot.

const draw = (
  over: {
    presentation?: Partial<ViewPresentation>;
    resolved?: Palette;
    hosted?: boolean;
    language?: "en-US" | "it-IT";
  } = {},
) => {
  const set: unknown[] = [];
  const controls: PresentationControls = {
    presentation: createStore({ ...DEFAULT_PRESENTATION, ...over.presentation }),
    resolvedPalette: createStore<Palette>(over.resolved ?? over.presentation?.palette ?? "carta"),
    hosted: over.hosted ?? true,
    set: (setting) => void set.push(setting),
    openSettings: () => undefined,
  };
  const html = renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: over.language ?? "en-US" },
      createElement(QuickToggles, { controls }),
    ),
  );
  return { html, set };
};

describe("the Theme popover's palette row", () => {
  test("is a radio group named Palette after Density, with the four names", () => {
    const { html } = draw();
    expect(html).toContain("data-askboard-palette");
    expect(html.indexOf("Density")).toBeLessThan(html.indexOf('aria-label="Palette"'));
    for (const name of ["Carta", "Nordico", "Grafite", "Contrasto"]) expect(html).toContain(name);
  });

  test("marks the palette in effect as checked, and no other", () => {
    const { html } = draw({ presentation: { palette: "grafite" } });
    const segment = (name: string) =>
      new RegExp(`aria-checked="(true|false)"[^>]*>${name}</button>`).exec(html)?.[1];
    expect(segment("Grafite")).toBe("true");
    expect(segment("Carta")).toBe("false");
    expect(segment("Nordico")).toBe("false");
  });

  test("is read-only, naming the project file and key, when the project sets it", () => {
    const { html } = draw({ presentation: { palette: "contrasto", locked: ["palette"] } });
    expect(html).toContain(".askboard/config.json · palette");
  });

  test("is free when no project sets it", () => {
    expect(draw().html).not.toContain(".askboard/config.json · palette");
  });

  test("is absent in a Snapshot, which carries one palette", () => {
    const { html } = draw({ hosted: false });
    expect(html).not.toContain("data-askboard-palette");
    expect(html).toContain("Density");
  });
});

describe("the palette row's note", () => {
  test("shows while the palette in use is not the chosen one", () => {
    const { html } = draw({ presentation: { palette: "nordico" }, resolved: "contrasto" });
    expect(html).toContain("data-askboard-palette-note");
    expect(html).toContain("The system asks for more contrast: Contrasto is in use.");
  });

  test("is not shown while they agree, including when Contrasto is the chosen one", () => {
    expect(draw().html).not.toContain("data-askboard-palette-note");
    expect(
      draw({ presentation: { palette: "contrasto" }, resolved: "contrasto" }).html,
    ).not.toContain("data-askboard-palette-note");
  });

  test("is a line under the row, not its description: the row stays free", () => {
    const { html } = draw({ presentation: { palette: "nordico" }, resolved: "contrasto" });
    expect(html).not.toContain("disabled");
  });

  test("speaks Italian in an Italian ask", () => {
    const { html } = draw({
      presentation: { palette: "nordico" },
      resolved: "contrasto",
      language: "it-IT",
    });
    expect(html).toContain("Il sistema chiede più contrasto: è in uso Contrasto.");
  });
});
