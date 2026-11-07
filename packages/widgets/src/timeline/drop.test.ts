import { describe, expect, test } from "bun:test";
import { TIMELINE_FIXTURE_ITEM } from "@askboard/contract/fixtures";
import { afterDrop, previewOf } from "./drop.ts";
import { layoutOf, spanOf } from "./layout.ts";

// The Timeline's drag as plain data (view-and-widgets spec: Timeline moves by drag; design decision
// 10): the props a drop makes, and where the dragged entry is drawn while the pointer moves.
const SENT = TIMELINE_FIXTURE_ITEM.props;
const entry = (props: typeof SENT, id: string) => props.entries.find((held) => held.id === id);

describe("afterDrop", () => {
  test("a drop a week later and in another lane moves the days and the lane, a range keeping its length", () => {
    const next = afterDrop(SENT, "checkout", { kind: "move", days: 7, lane: "mobile" });
    expect(entry(next ?? SENT, "checkout")).toMatchObject({
      lane: "mobile",
      start: "2026-01-12",
      end: "2026-03-06",
    });
    expect(entry(next ?? SENT, "launch")).toEqual(entry(SENT, "launch"));
  });

  test("a vertical drop moves only the lane, a horizontal one over no lane only the days", () => {
    expect(
      entry(afterDrop(SENT, "launch", { kind: "move", days: 0, lane: "web" }) ?? SENT, "launch"),
    ).toEqual({
      id: "launch",
      label: "Public launch",
      lane: "web",
      date: "2026-03-02",
    });
    expect(
      entry(
        afterDrop(SENT, "launch", { kind: "move", days: -3, lane: undefined }) ?? SENT,
        "launch",
      ),
    ).toMatchObject({ lane: "mobile", date: "2026-02-27" });
  });

  test("a click, a drop where the entry stands and an entry the item lacks give none", () => {
    expect(afterDrop(SENT, "launch", { kind: "click" })).toBeUndefined();
    expect(afterDrop(SENT, "launch", { kind: "move", days: 0, lane: "mobile" })).toBeUndefined();
    expect(afterDrop(SENT, "launch", { kind: "move", days: 0, lane: undefined })).toBeUndefined();
    expect(afterDrop(SENT, "zz", { kind: "move", days: 3, lane: "web" })).toBeUndefined();
  });
});

describe("previewOf", () => {
  const layout = layoutOf(SENT, spanOf(SENT, SENT), "week");

  test("a move shows the entry shifted by the whole days it snaps to and by the lanes it crosses", () => {
    const web = layout.lanes[0];
    const mobile = layout.lanes[1];
    expect(
      previewOf(layout, "checkout", { kind: "move", days: 7, lane: "mobile" }, "week"),
    ).toEqual({ dx: 7 * 15, dy: (mobile?.top ?? 0) - (web?.top ?? 0) });
    expect(previewOf(layout, "launch", { kind: "move", days: -2, lane: undefined }, "day")).toEqual(
      { dx: -2 * 32, dy: 0 },
    );
  });

  test("a click, or an entry the layout lacks, shows no shift", () => {
    expect(previewOf(layout, "launch", { kind: "click" }, "week")).toEqual({ dx: 0, dy: 0 });
    expect(previewOf(layout, "zz", { kind: "move", days: 3, lane: "web" }, "week")).toEqual({
      dx: 0,
      dy: 0,
    });
  });
});
