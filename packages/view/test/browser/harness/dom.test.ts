// The frame's locators (answering-flow-visual, task 3.1): each is a `data-askboard-*` hook in the
// view's frame, never a label. Checked against a recording stand-in for the page, with no browser.

import { describe, expect, test } from "bun:test";
import type { Page } from "playwright";
import { boardOf } from "./dom.ts";

const recorder = (path: string): unknown =>
  new Proxy(() => undefined, {
    get: (_target, prop) => {
      if (prop === Symbol.toPrimitive || prop === "toString") return () => path;
      return (...args: unknown[]) =>
        recorder(`${path}.${String(prop)}(${args.map((arg) => String(arg)).join(", ")})`);
    },
  });

const page = recorder("page") as Page;
const board = boardOf(
  new Proxy(page, {
    get: (target, prop) =>
      prop === "frameLocator" ? () => recorder("view") : Reflect.get(target, prop),
  }),
);

const selector = (locator: unknown): string => String(locator);

describe("the frame's locators", () => {
  test("the rows, the rail, the outbox and the Theme control, by hook", () => {
    expect(selector(board.askRow)).toContain("[data-askboard-ask-row]");
    expect(selector(board.progressRow)).toContain("[data-askboard-progress-row]");
    expect(selector(board.rail)).toContain("[data-askboard-rail]");
    expect(selector(board.outbox)).toContain("[data-askboard-outbox]");
    expect(selector(board.themeControl)).toContain("[data-askboard-theme]");
    expect(selector(board.paletteRow)).toContain("[data-askboard-palette]");
    expect(selector(board.paletteNote)).toContain("[data-askboard-palette-note]");
  });

  test("a ledger cell, a strip segment, a tray message and an Edit take their key", () => {
    expect(selector(board.ledger("ready"))).toContain('[data-askboard-ledger="ready"]');
    expect(selector(board.strip("q3"))).toContain('[data-askboard-strip="q3"]');
    expect(selector(board.tray("added"))).toContain('[data-askboard-tray="added"]');
    expect(selector(board.edit("q2"))).toContain('[data-askboard-edit="q2"]');
  });

  test("the controls of the cards and the header, by hook or role", () => {
    for (const locator of [
      board.question("q1"),
      board.loaded("q1"),
      board.option("Yes"),
      board.delivery("submitted"),
      board.receipt("sent"),
      board.banner("closed"),
      board.field("Project"),
    ]) {
      expect(selector(locator)).not.toBe("");
    }
    expect(selector(board.question("q1"))).toContain('[data-askboard-question="q1"]');
    expect(selector(board.delivery("submitted"))).toContain('[data-askboard-delivery="submitted"]');
    expect(selector(board.receipt("sent"))).toContain('[data-askboard-receipt="sent"]');
  });
});
