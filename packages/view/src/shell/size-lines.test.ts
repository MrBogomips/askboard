import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext, LocaleContext } from "../catalog/port.ts";
import { SizeLines, type SizeLinesProps } from "./size-lines.tsx";
import { FIELD_ERROR } from "./styles.ts";

// The lines under the question actions for a message too large (oversized-acts, task 1.4; design
// decisions 2, 3, 4 and 7; NFR-12): a polite status in the Field error style, in the ask's language.
// `ActionsRow` renders them; the browser scenario covers the row itself.

const render = (extra: SizeLinesProps, language: "en-US" | "it-IT" = "en-US") =>
  renderToStaticMarkup(
    createElement(
      LanguageContext.Provider,
      { value: language },
      createElement(LocaleContext.Provider, { value: language }, createElement(SizeLines, extra)),
    ),
  );

const size = { bytes: 6_800_000, max: 6_004_096 };

describe("the lines under the question actions", () => {
  test("no notice, no line", () => {
    expect(render({})).not.toContain('role="status"');
  });

  test("an answer too large: its line as a polite status in the Field error style, with the sizes", () => {
    const html = render({ notice: { kind: "answer", size } });
    expect(html).toMatch(new RegExp(`<p[^>]*role="status"[^>]*class="${FIELD_ERROR}"`));
    expect(html).toContain("Not sent: this answer is too large (6.8 MB, at most 6 MB).");
  });

  test("a Submit too large, and a socket closed as too large", () => {
    expect(render({ notice: { kind: "submit", size } })).toContain(
      "Not sent: Submit is too large to send at once (6.8 MB, at most 6 MB).",
    );
    expect(render({ notice: { kind: "closed" } })).toContain(
      "Not sent: the board refused this answer as too large.",
    );
  });

  test("a question left out of the draft shows the draft line", () => {
    const html = render({ draftLeftOut: true });
    expect(html).toContain("Too large to keep across a reload");
    expect(html).toMatch(new RegExp(`role="status"[^>]*class="${FIELD_ERROR}"`));
  });

  test("both lines show, each its own status, when both apply", () => {
    const html = render({ notice: { kind: "answer", size }, draftLeftOut: true });
    expect(html.match(/role="status"/g)).toHaveLength(2);
  });

  test("in Italian: the Italian texts and the decimal comma", () => {
    const html = render({ notice: { kind: "answer", size }, draftLeftOut: true }, "it-IT");
    expect(html).toContain(
      "Non inviata: questa risposta è troppo grande (6,8 MB, al massimo 6 MB).",
    );
    expect(html).toContain("Troppo grande per conservarlo dopo un ricaricamento");
  });

  test("agent text is not part of a line: the question's work never appears in it", () => {
    const html = render({ notice: { kind: "closed" } });
    expect(html).not.toContain("<script");
  });
});
