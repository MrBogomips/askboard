// The palette key and the minors it moves (palettes, task 1.1, design decision D1). The three
// numbers below are the minors this change holds beside the constants (askboard-contract-versioning,
// Rule 1); they are the next minors after the stacked base (answering-flow-visual at 73e3305f) and
// the rebase task binds them. The next change that widens a set moves them.

import { describe, expect, test } from "bun:test";
import {
  lifecycleSnapshotData,
  palettesConfiguration,
  palettesSaved,
  palettesSetting,
  settingsWithEveryKey,
  settingsWithPalette,
} from "../src/fixtures/index.ts";
import {
  BOARD_PROTOCOL_VERSION,
  CONFIGURATION_DEFAULTS,
  CONFIGURATION_KEYS,
  CONFIGURATION_VERSION,
  PALETTES,
  PRESENTATION_KEYS,
  SCHEMA_SETS,
  SNAPSHOT_DATA_VERSION,
} from "../src/index.ts";
import {
  type Checked,
  validateBoardMessage,
  validateConfiguration,
  validateSnapshotData,
} from "../src/validate.ts";

const versionOf = (name: string) => SCHEMA_SETS.find((set) => set.name === name)?.version;
const header = async (path: string) =>
  (await Bun.file(new URL(path, import.meta.url)).text()).split("\nimport ")[0];
const pathsOf = (result: Checked<unknown>) =>
  result.ok ? [] : result.problems.map((problem) => problem.path);
const toPage = (message: unknown) => validateBoardMessage("toPage", message);
const toHost = (message: unknown) => validateBoardMessage("toHost", message);
const file = (fields: Record<string, unknown>) => ({ version: "1.0", ...fields });
const clone = <T>(value: T): Record<string, any> => JSON.parse(JSON.stringify(value));

describe("the minors", () => {
  test("configuration 1.3, board protocol at least 1.13, Snapshot data 1.5, each set at its constant", () => {
    expect(CONFIGURATION_VERSION).toBe("1.3");
    // Later changes move the minor on: palettes' is the floor.
    expect(Number(BOARD_PROTOCOL_VERSION.split(".")[1])).toBeGreaterThanOrEqual(13);
    expect(SNAPSHOT_DATA_VERSION).toBe("1.5");
    expect(versionOf("configuration")).toBe(CONFIGURATION_VERSION);
    expect(versionOf("board-protocol")).toBe(BOARD_PROTOCOL_VERSION);
    expect(versionOf("snapshot-data")).toBe(SNAPSHOT_DATA_VERSION);
  });

  test("each module's header names this change", async () => {
    for (const path of [
      "../src/schemas/configuration/index.ts",
      "../src/schemas/board-protocol/index.ts",
      "../src/schemas/snapshot-data/index.ts",
    ]) {
      expect(await header(path)).toContain("palettes");
    }
  });
});

describe("the palette key", () => {
  test("the palettes are exactly carta, nordico, grafite, contrasto; the default is carta", () => {
    expect(PALETTES).toEqual(["carta", "nordico", "grafite", "contrasto"]);
    expect(CONFIGURATION_DEFAULTS.palette).toBe("carta");
  });

  test("palette is a presentation key, appended after afterAnswer, and a configuration key", () => {
    expect(PRESENTATION_KEYS).toEqual([
      "theme",
      "density",
      "contextPlacement",
      "afterAnswer",
      "palette",
    ]);
    expect(CONFIGURATION_KEYS.slice(0, 5)).toEqual([...PRESENTATION_KEYS]);
    expect(CONFIGURATION_KEYS).toHaveLength(11);
  });

  test("a file with every key validates, and one of the previous minor passes", () => {
    expect(Object.keys(palettesConfiguration)).toEqual(["version", ...CONFIGURATION_KEYS]);
    expect(validateConfiguration(palettesConfiguration).ok).toBe(true);
    const { palette: _, ...previous } = palettesConfiguration;
    expect(validateConfiguration({ ...previous, version: "1.2" }).ok).toBe(true);
  });

  test.each(PALETTES)("a file sets palette to %s", (palette) => {
    expect(validateConfiguration(file({ palette })).ok).toBe(true);
  });

  test.each(["inchiostro", "Carta", "", 3])(
    "a file setting palette to %p fails, naming it",
    (v) => {
      const checked = validateConfiguration(file({ palette: v }));
      expect(checked.ok).toBe(false);
      expect(pathsOf(checked).length).toBeGreaterThan(0);
      for (const path of pathsOf(checked)) expect(path).toBe("/palette");
    },
  );
});

describe("the board protocol", () => {
  test("a write of each palette validates", () => {
    for (const value of PALETTES) {
      expect(toHost({ ...palettesSetting, value }).ok).toBe(true);
    }
  });

  test.each(["inchiostro", 'carta"] body{', "", null])("a write of palette %p fails", (value) => {
    expect(toHost({ ...palettesSetting, value }).ok).toBe(false);
  });

  test("the other keys still fail, and the old keys' values keep their sets", () => {
    for (const key of ["editor", "askingRule", "snapshotFolder", "keys"]) {
      expect(toHost({ ...palettesSetting, key }).ok).toBe(false);
    }
    expect(toHost({ ...palettesSetting, key: "theme", value: "grafite" }).ok).toBe(false);
    expect(toHost({ ...palettesSetting, key: "afterAnswer", value: "nordico" }).ok).toBe(false);
    expect(toHost({ ...palettesSetting, key: "theme", value: "dark" }).ok).toBe(true);
  });

  test("the settings with a palette row, and the saved outcome, validate", () => {
    expect(settingsWithPalette.keys.palette).toBeDefined();
    expect(toPage(settingsWithPalette).ok).toBe(true);
    expect(palettesSaved.write).toEqual({ key: "palette", outcome: "saved" });
    expect(toPage(palettesSaved).ok).toBe(true);
  });

  test("a settings message without the row passes; a row of another value fails, naming it", () => {
    expect(toPage({ ...settingsWithEveryKey, version: BOARD_PROTOCOL_VERSION }).ok).toBe(true);
    const bad = clone(settingsWithPalette);
    bad.keys.palette.value = "inchiostro";
    expect(pathsOf(toPage(bad))).toContain("/keys/palette/value");
    const other = clone(settingsWithPalette);
    other.keys.palette.other = { file: "user", value: "inchiostro" };
    expect(pathsOf(toPage(other)).length).toBeGreaterThan(0);
  });

  test("a write outcome naming palette passes; one naming another key fails", () => {
    const refused = { ...settingsWithEveryKey, write: { key: "palette", outcome: "refused" } };
    expect(toPage(refused).ok).toBe(true);
    expect(toPage({ ...refused, write: { key: "editor", outcome: "saved" } }).ok).toBe(false);
  });
});

describe("the presentation in the Snapshot data", () => {
  const withPresentation = (presentation: unknown) => {
    const data = clone(lifecycleSnapshotData);
    data.snapshot.presentation = presentation;
    return data;
  };

  test("a presentation with each palette passes, with or without a palette", () => {
    for (const palette of PALETTES) {
      expect(
        validateSnapshotData(withPresentation({ theme: "dark", density: "compact", palette })).ok,
      ).toBe(true);
    }
    expect(
      validateSnapshotData(withPresentation({ theme: "light", density: "comfortable" })).ok,
    ).toBe(true);
  });

  test("a palette the configuration does not allow fails, naming the field", () => {
    const checked = validateSnapshotData(
      withPresentation({ theme: "dark", density: "compact", palette: "inchiostro" }),
    );
    expect(pathsOf(checked)).toContain("/snapshot/presentation/palette");
  });

  test("a user's record takes a palette too", () => {
    const data = clone(lifecycleSnapshotData);
    data.snapshot = {
      takenAt: "2026-11-16T10:00:00Z",
      takenBy: "user",
      who: "Giulia Rossi",
      presentation: { theme: "dark", density: "compact", palette: "contrasto" },
    };
    expect(validateSnapshotData(data).ok).toBe(true);
  });
});
