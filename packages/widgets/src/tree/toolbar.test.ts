import { describe, expect, test } from "bun:test";
import { COUNTER, TOOLS } from "./classes.ts";

// Review F-16: the counter truncates before it overprints a tool, its idle text is "No changes"
// from the catalogue, and the move tools go into "More" when the row is crowded. The rendering is
// checked in the browser (tree-toolbar.browser.ts); this holds what a unit can.
const source = (path: string): Promise<string> => Bun.file(new URL(path, import.meta.url)).text();

describe("the Tree toolbar's counter", () => {
  test("gives way: it may shrink and truncates, while the tools keep their width", () => {
    expect(COUNTER).toContain("min-w-0");
    expect(COUNTER).not.toContain("shrink-0");
    expect(TOOLS).toContain("shrink-0");
  });

  test("reads its words from the catalogue, never the old idle text", async () => {
    const toolbar = await source("./toolbar.tsx");
    expect(toolbar).toContain('"widget.noChanges"');
    expect(toolbar).toContain('"widget.yourChanges"');
    expect(toolbar).not.toContain("none yet");
    expect(toolbar).not.toContain("Your changes:");
  });

  test("offers the move tools in a More menu, measured by the overflow model", async () => {
    const toolbar = await source("./toolbar.tsx");
    expect(toolbar).toContain('"widget.more"');
    expect(toolbar).toContain("DropdownMenu");
    expect(toolbar).toContain("useCrowded");
    expect(await source("./use-crowded.ts")).toContain("isCrowded");
    expect(toolbar).toContain("OVERFLOW_TOOLS");
  });
});
