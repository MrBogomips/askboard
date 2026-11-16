import { describe, expect, test } from "bun:test";
import { PALETTES } from "@askboard/contract";
import { settingsWithEveryKey, settingsWithPalette } from "@askboard/contract/fixtures";
import { presentationOf } from "./board-page/presentation.ts";
import { panelData } from "./board-page/settings-panel-data.ts";
import { snapshotPresentationOf } from "./shell/opened-snapshot.ts";
import { isPresentation, readViewMessage, VIEW_TOOL_PREFIX } from "./view-protocol.ts";

// The palette on the view's protocol, presentation and panel (palettes, task 3.2, design decision
// D6; view spec scenario "A record the page does not know").

const settingCall = (key: unknown, value: unknown) =>
  readViewMessage({ name: `${VIEW_TOOL_PREFIX}setting`, arguments: { key, value } });
const base = {
  theme: "system",
  density: "compact",
  contextPlacement: "beside",
  afterAnswer: "next",
  palette: "carta",
  locked: [],
};

describe("the palette in the view's protocol", () => {
  test("a setting of each listed palette is read", () => {
    for (const value of PALETTES) expect(settingCall("palette", value).ok).toBe(true);
  });

  test("a palette the contract does not name, or text built to break out, is refused", () => {
    for (const value of ["inchiostro", 'carta"] body{', "", 3, null, undefined]) {
      expect(settingCall("palette", value).ok).toBe(false);
    }
  });

  test("the presentation needs a listed palette, and locked admits the key", () => {
    expect(isPresentation(base)).toBe(true);
    expect(isPresentation({ ...base, locked: ["palette"] })).toBe(true);
    for (const palette of ["inchiostro", undefined, 3, 'carta" x']) {
      expect(isPresentation({ ...base, palette })).toBe(false);
    }
    expect(isPresentation({ ...base, locked: ["palettes"] })).toBe(false);
  });
});

describe("the presentation a settings message gives", () => {
  test("reads the palette row, the user's value in effect", () => {
    expect(presentationOf(settingsWithPalette).palette).toBe("nordico");
  });

  test("is carta when the message holds no palette row", () => {
    expect(presentationOf(settingsWithEveryKey).palette).toBe("carta");
  });

  test("locks the key when the project file sets it", () => {
    const project = {
      ...settingsWithPalette,
      keys: {
        ...settingsWithPalette.keys,
        palette: { value: "contrasto", from: "project", writable: false },
      },
    } as typeof settingsWithPalette;
    const presentation = presentationOf(project);
    expect(presentation.palette).toBe("contrasto");
    expect(presentation.locked).toContain("palette");
  });
});

describe("a record the page does not know", () => {
  const record = { takenAt: "2026-11-16T10:00:00Z", takenBy: "agent" } as const;
  const opened = (palette: unknown) =>
    snapshotPresentationOf({
      ...record,
      presentation: { theme: "dark", density: "compact", palette },
    } as never);

  test("a listed palette is the Snapshot's", () => {
    for (const palette of PALETTES) expect(opened(palette).palette).toBe(palette);
  });

  test("none, an unknown name or text that is no name opens in Carta, theme and density kept", () => {
    for (const palette of [undefined, "inchiostro", 'carta"] body{', 3, null]) {
      expect(opened(palette)).toMatchObject({
        palette: "carta",
        theme: "dark",
        density: "compact",
      });
    }
  });
});

describe("the settings panel's palette row", () => {
  test("is a segmented row after After answering, with the four names and the value in effect", () => {
    const controls = panelData(
      settingsWithPalette,
      presentationOf(settingsWithPalette),
      "en-US",
      "en-US",
    ).controls;
    const row = controls.find((control) => control.key === "palette");
    expect(controls.at(-1)?.key).toBe("palette");
    expect(row?.label).toBe("Palette");
    expect(row?.segments.map((segment) => segment.value)).toEqual([...PALETTES]);
    expect(row?.segments.map((segment) => segment.label)).toEqual([
      "Carta",
      "Nordico",
      "Grafite",
      "Contrasto",
    ]);
    expect(row?.value).toBe("nordico");
  });
});
