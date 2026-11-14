import { describe, expect, test } from "bun:test";

// The selection and the adjustment in the view (spec: Tree row selection, Tree selection is view
// state, Tree bulk percentage adjustment panel, Tree adjustment undo). The rendering is checked in
// the browser (tree-selection, tree-adjust and tree-coherence scenarios); this holds what a unit can.
const source = (path: string): Promise<string> => Bun.file(new URL(path, import.meta.url)).text();

describe("the selection column", () => {
  test("is a leading column of every row, the header and the Total row, out of the Tab order", async () => {
    for (const file of ["./row.tsx", "./grid.tsx", "./total-row.tsx"]) {
      expect(await source(file)).toContain("SELECT_COLUMN");
    }
    expect(await source("../shared/select-box.tsx")).toContain("tabIndex={-1}");
  });

  test("selecting never touches the draft: the host holds it as state and clears it when read-only", async () => {
    const widget = await source("./widget.tsx");
    expect(widget).toContain("useState<Selection>");
    expect(widget).toContain("if (disabled && picked.size > 0) setPicked(NO_SELECTION)");
    expect(widget).toContain("pruned(picked, value)");
  });
});

describe("the adjustment panel and its undo", () => {
  test("Apply is disabled unless the plan the preview shows is ready and changes something", async () => {
    const panel = await source("./adjust-panel.tsx");
    expect(panel).toContain("disabled={!canApply}");
    expect(panel).toContain('plan?.kind === "ready" && plan.changes.length > 0');
  });

  test("the percentage field shows no echo", async () => {
    expect(await source("./adjust-panel.tsx")).not.toContain("numberEcho");
  });

  test("undo goes through the value, the slot emptied by any other edit", async () => {
    const widget = await source("./widget.tsx");
    expect(widget).toContain("liveSlot(slot, value, disabled)");
    expect(widget).toContain("setSlot(undefined)");
  });
});
