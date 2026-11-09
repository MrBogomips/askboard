import { describe, expect, test } from "bun:test";
import { SEGMENT, SEGMENTS } from "./segment-classes.ts";

// Review F-17: the header, the settings panel, the delivery switch and the Gantt zoom use one
// segment class, so that the chosen segment is underlined everywhere.
const text = (path: string): Promise<string> => Bun.file(new URL(path, import.meta.url)).text();

/** Every file that draws a segmented control, with the track and segment names it must carry. */
const CONTROLS = [
  "./segmented.tsx",
  "./bottom-bar.tsx",
  "./context-column.tsx",
  "../board-page/settings-panel.ts",
] as const;

describe("the segmented controls' one class", () => {
  test("the stylesheet gives the chosen segment the 2px primary underline, whichever state it uses", async () => {
    const css = await text("../styles/segment.css");
    expect(css).toContain(`.${SEGMENTS} {`);
    const chosen = css.slice(css.indexOf('[aria-pressed="true"]'));
    expect(chosen).toContain('[aria-checked="true"]');
    expect(chosen).toContain('[data-state="on"]');
    expect(chosen).toContain("border-bottom-color: var(--primary)");
    expect(chosen).toContain("font-weight: 600");
    expect(css).toContain("border-bottom: 2px solid transparent");
    expect(await text("../styles/base.css")).toContain('@import "./segment.css";');
  });

  for (const file of CONTROLS) {
    test(`${file} draws its track and segments with the shared class names, not its own look`, async () => {
      const source = await text(file);
      expect(source).toContain("SEGMENTS");
      expect(source).toContain("SEGMENT");
      expect(source).not.toContain("aria-checked:bg-card");
      expect(source).not.toContain("aria-pressed:border-primary");
      expect(source).not.toContain("aria-pressed:bg-muted");
    });
  }

  test("the class names are the stylesheet's", () => {
    expect([SEGMENTS, SEGMENT]).toEqual(["askboard-segments", "askboard-segment"]);
  });
});
