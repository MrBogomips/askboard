import { describe, expect, test } from "bun:test";
import { type Say, say } from "@askboard/view/catalog";
import { renderToStaticMarkup } from "react-dom/server";
import { DETACHED, DOCUMENT } from "./classes.ts";
import { ReviewFrame, type ReviewFrameProps } from "./frame.tsx";

// The Document review's frame (view-and-widgets spec: A Document review's document, Commenting on a
// passage, A Document review read-only and in Snapshots, A Document review at the keyboard, Document
// review strings): the title, the document, the toolbar and its counter and message, and the
// detached list, through the server renderer. The selection, the marks and the popover are measured
// in a browser.
const NONE = () => {};

const frame = (over: Partial<ReviewFrameProps> = {}, language: "en-US" | "it-IT" = "en-US") => {
  const words: Say = (key, slots) => say(language, key, slots);
  return renderToStaticMarkup(
    <ReviewFrame
      say={words}
      title="Release notes"
      editable={true}
      counter="No comments yet"
      message=""
      onTool={NONE}
      document={<div data-doc="" />}
      {...over}
    >
      <i data-extra="" />
    </ReviewFrame>,
  );
};

describe("the frame", () => {
  test("shows the title as text, the document, the toolbar with both tools and the counter", () => {
    const html = frame();
    expect(html).toContain("Release notes");
    expect(html).toContain('data-doc=""');
    expect(html).toContain('role="toolbar"');
    expect(html).toContain(">Comment</button>");
    expect(html).toContain(">Suggest edit</button>");
    expect(html).toContain("No comments yet");
    expect(html).toContain('data-extra=""');
  });

  test("puts the document before the toolbar in the document order, the toolbar above it on the screen", () => {
    const html = frame();
    expect(html.indexOf("data-doc")).toBeLessThan(html.indexOf('role="toolbar"'));
    expect(html).toMatch(/order-1[^"]*"[^>]*>Release notes/);
    expect(html).toMatch(/order-2[^"]*"/);
    // The document's own element, which the widget gives, takes the order after the toolbar's.
    expect(DOCUMENT).toContain("order-3");
    expect(DETACHED).toContain("order-4");
  });

  test("has no title element when there is none", () => {
    expect(frame({ title: undefined })).not.toContain("order-1");
  });

  test("a read-only frame has no toolbar, no counter and no message", () => {
    const html = frame({ editable: false, message: "Select one passage." });
    expect(html).not.toContain('role="toolbar"');
    expect(html).not.toContain("No comments yet");
    expect(html).not.toContain("Select one passage.");
    expect(html).toContain('data-doc=""');
  });

  test("the message sits beside the tools in a polite live region that is there before it has text", () => {
    const empty = frame();
    expect(empty).toMatch(/<p[^>]*role="status"[^>]*aria-live="polite"[^>]*><\/p>/);
    const said = frame({ message: "Select one passage." });
    expect(said).toMatch(/role="status"[^>]*>Select one passage\.<\/p>/);
  });

  test("the tools are one Tab stop: the first has tabindex 0, the second -1", () => {
    const html = frame();
    expect(html).toMatch(/tabindex="0"[^>]*>Comment<\/button>/);
    expect(html).toMatch(/tabindex="-1"[^>]*>Suggest edit<\/button>/);
  });

  test("every element holding agent or user text wraps a word with no space (200 characters)", () => {
    const long = "w".repeat(200);
    const html = frame({ title: long, message: long, counter: long });
    for (const text of [long]) {
      const found = [...html.matchAll(new RegExp(`class="([^"]*)"[^>]*>${text}<`, "g"))];
      expect(found.length).toBe(3);
      for (const [, classes] of found) expect(classes).toContain("break-words");
    }
  });

  test("reads in Italian on an Italian board, and holds no English string of its own", () => {
    const html = frame({ counter: "Nessun commento" }, "it-IT");
    expect(html).toContain(">Commenta</button>");
    expect(html).toContain(">Suggerisci modifica</button>");
    expect(html).toContain('aria-label="Strumenti della revisione del documento"');
    expect(html).not.toContain(">Comment<");
    expect(html).not.toContain("Suggest edit");
    expect(html).not.toContain("Document review tools");
  });

  test("sets no style attribute", () => {
    expect(frame()).not.toContain("style=");
  });
});
