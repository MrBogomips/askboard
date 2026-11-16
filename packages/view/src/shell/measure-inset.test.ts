import { describe, expect, test } from "bun:test";
import { measureBoardInset, measureInset } from "./measure-inset.ts";

// The DOM reads, against a stand-in document: the real layout is checked in the browser, and the
// arithmetic of `insetFrom` and `boardInsetFrom` in `inset.test.ts`.
type Bars = { header?: number; footers?: number[]; strip?: number; height?: number };

const rect = (edge: number) => ({ getBoundingClientRect: () => ({ top: edge, bottom: edge }) });

const documentWith = (bars: Bars): Document => {
  const footers = (bars.footers ?? []).map(rect);
  return {
    defaultView: bars.height === undefined ? null : { innerHeight: bars.height },
    querySelector: (selector: string) => {
      if (selector === "header") return bars.header === undefined ? null : rect(bars.header);
      if (selector === "[data-askboard-tab-strip]")
        return bars.strip === undefined ? null : rect(bars.strip);
      return null;
    },
    querySelectorAll: () => ({ length: footers.length, item: (i: number) => footers[i] ?? null }),
  } as unknown as Document;
};

describe("the reading panel's inset", () => {
  test("is the header's bottom and the viewport's height less the last footer's top", () => {
    const inset = measureInset(documentWith({ header: 60, footers: [100, 720], height: 800 }));
    expect(inset).toEqual({ top: 60, bottom: 80 });
  });

  test("counts a bar the view does not have as 0", () => {
    expect(measureInset(documentWith({ height: 800 }))).toEqual({ top: 0, bottom: 0 });
  });
});

describe("the board's inset", () => {
  test("is the header's alone on a board without a strip of tabs", () => {
    const inset = measureBoardInset(documentWith({ header: 60, footers: [720], height: 800 }));
    expect(inset).toEqual({ top: 60, bottom: 80 });
  });

  test("clears the sticky strip when there is one", () => {
    const inset = measureBoardInset(
      documentWith({ header: 60, strip: 104, footers: [720], height: 800 }),
    );
    expect(inset).toEqual({ top: 104, bottom: 80 });
  });

  test("counts no bar as 0", () => {
    expect(measureBoardInset(documentWith({ height: 800 }))).toEqual({ top: 0, bottom: 0 });
  });
});
