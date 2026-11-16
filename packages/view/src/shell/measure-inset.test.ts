import { describe, expect, test } from "bun:test";
import { measureBoardInset, measureInset } from "./measure-inset.ts";

// The DOM reads, against a stand-in document: the real layout is checked in the browser, and the
// arithmetic of `insetFrom` and `boardInsetFrom` in `inset.test.ts`. There is no bottom bar, so no
// bottom inset (answering-flow-visual, design decision 12).
type Bars = { header?: number; strip?: number; tray?: number };

const rect = (edge: number) => ({ getBoundingClientRect: () => ({ top: edge, bottom: edge }) });

const documentWith = (bars: Bars): Document =>
  ({
    querySelector: (selector: string) => {
      const edge =
        selector === "header"
          ? bars.header
          : selector === "[data-askboard-tab-strip]"
            ? bars.strip
            : selector === "[data-askboard-tray-box]"
              ? bars.tray
              : undefined;
      return edge === undefined ? null : rect(edge);
    },
  }) as unknown as Document;

describe("the panels' inset", () => {
  test("is the header's bottom, and 0 at the foot", () => {
    expect(measureInset(documentWith({ header: 96 }))).toEqual({ top: 96, bottom: 0 });
  });

  test("counts a header the view does not have as 0", () => {
    expect(measureInset(documentWith({}))).toEqual({ top: 0, bottom: 0 });
  });
});

describe("the board's inset", () => {
  test("is the header's alone on a board without a strip of tabs or a tray", () => {
    expect(measureBoardInset(documentWith({ header: 96 }))).toEqual({ top: 96, bottom: 0 });
  });

  test("clears the sticky strip when there is one", () => {
    expect(measureBoardInset(documentWith({ header: 96, strip: 136 }))).toEqual({
      top: 136,
      bottom: 0,
    });
  });

  test("clears the tray while it holds a message", () => {
    expect(measureBoardInset(documentWith({ header: 96, strip: 136, tray: 190 }))).toEqual({
      top: 190,
      bottom: 0,
    });
  });

  test("counts no bar as 0", () => {
    expect(measureBoardInset(documentWith({}))).toEqual({ top: 0, bottom: 0 });
  });
});
