import { describe, expect, test } from "bun:test";
import { plainChoiceBoardDocument } from "@askboard/contract/fixtures";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useStrings } from "../catalog/port.ts";
import type { ViewDocument } from "../view-document.ts";
import type { BoardView } from "./board.tsx";
import { BoardLanguage } from "./board-language.tsx";
import { createStore } from "./store.ts";

// The view takes the board's language from the board document, en-US when it holds none
// (settings-languages, task 7.2; spec view-and-widgets, "The board's interface in the ask's
// language").

const Probe = (): ReactNode => useStrings()("question.answer");

const rendered = (document: ViewDocument): string => {
  const view = createStore<BoardView>({ document } as unknown as BoardView);
  return renderToStaticMarkup(createElement(BoardLanguage, { view }, createElement(Probe)));
};

describe("the shell's language", () => {
  test("is the board document's", () => {
    expect(rendered({ ...plainChoiceBoardDocument, language: "it-IT" } as ViewDocument)).toBe(
      "Rispondi",
    );
  });

  test("is en-US for a document without one", () => {
    expect(rendered(plainChoiceBoardDocument as ViewDocument)).toBe("Answer");
  });
});
