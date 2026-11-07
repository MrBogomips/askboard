import { describe, expect, test } from "bun:test";
import { STRINGS, t } from "./index.ts";
import type { StringKey } from "./keys.ts";

// The Chart's strings (view-and-widgets spec: The Chart's strings; ux-update-draft.md block 1): the
// counter, the live region's "highlighted", the keyboard hint, the role description and the name in
// the agent-change notice, each in both tables, an Italian board showing them in Italian (the
// Italian texts are marked to review in the table, as the draft marks them).
const KEYS: readonly StringKey[] = [
  "chart.noPoints",
  "chart.points",
  "chart.highlighted",
  "chart.hint",
  "chart.role",
  "change.widgetChart",
];

describe("the Chart's strings", () => {
  test("are in both tables", () => {
    for (const key of KEYS) {
      expect(Object.hasOwn(STRINGS["en-US"], key), key).toBe(true);
      expect(Object.hasOwn(STRINGS["it-IT"], key), key).toBe(true);
    }
  });

  test("read in English", () => {
    expect(t("en-US", "chart.noPoints")).toBe("No points highlighted");
    expect(t("en-US", "chart.points", { count: 1 })).toBe("1 point highlighted");
    expect(t("en-US", "chart.points", { count: 3 })).toBe("3 points highlighted");
    expect(t("en-US", "chart.highlighted")).toBe("highlighted");
    expect(t("en-US", "chart.hint")).toBe("Arrow keys move between points. Space highlights.");
    expect(t("en-US", "chart.role")).toBe("chart");
    expect(t("en-US", "change.widgetChart")).toBe("Chart");
  });

  test("read in Italian", () => {
    expect(t("it-IT", "chart.noPoints")).toBe("Nessun punto evidenziato");
    expect(t("it-IT", "chart.points", { count: 1 })).toBe("1 punto evidenziato");
    expect(t("it-IT", "chart.points", { count: 3 })).toBe("3 punti evidenziati");
    expect(t("it-IT", "chart.highlighted")).toBe("evidenziato");
    expect(t("it-IT", "chart.hint")).toBe("Le frecce spostano tra i punti. Spazio evidenzia.");
    expect(t("it-IT", "chart.role")).toBe("grafico");
    expect(t("it-IT", "change.widgetChart")).toBe("Grafico");
  });

  test("the Italian texts stand marked to review where the keys are listed", async () => {
    const keys = await Bun.file(`${import.meta.dir}/keys.ts`).text();
    const italian = await Bun.file(`${import.meta.dir}/it-IT.ts`).text();
    expect(keys).toMatch(/The Chart \(chart-widget[^\n]*texts to review/);
    expect(italian).toMatch(/The Chart \(chart-widget[^\n]*to review/);
  });
});
