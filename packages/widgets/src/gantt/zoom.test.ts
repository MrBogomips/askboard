import { describe, expect, test } from "bun:test";

// The Gantt zoom is a segmented control: a widget cannot import the view's class names (AD-1), so
// it repeats them and this test holds the two together (review F-17).
const text = (path: string): Promise<string> => Bun.file(new URL(path, import.meta.url)).text();

describe("the Gantt zoom's segment class", () => {
  test("its track and segments carry the names the view's stylesheet defines", async () => {
    const names = await text("../../../view/src/shell/segment-classes.ts");
    const zoom = await text("./zoom.tsx");
    for (const name of ["askboard-segments", "askboard-segment"]) {
      expect(names).toContain(`"${name}"`);
      expect(zoom).toContain(`"${name}"`);
    }
    expect(zoom).not.toContain("data-[state=on]:border-primary");
  });
});
