import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AnnotationList } from "./list.tsx";

// The shared annotation list (document-review, design decision 7): entries of a label, an excerpt
// and a text, each with an optional "Delete". The detached annotations are one use of it.
const NONE = () => {};

describe("the annotation list", () => {
  test("shows each entry's label, excerpt and text under the heading", () => {
    const html = renderToStaticMarkup(
      <AnnotationList
        heading="Detached comments"
        entries={[
          { id: "u-1", label: "Comment 1", excerpt: "remembers", text: "Say how long." },
          { id: "u-2", label: "Comment 2", excerpt: "drafts" },
        ]}
      />,
    );
    expect(html).toContain("Detached comments");
    expect(html).toContain("Comment 1");
    expect(html).toContain("remembers");
    expect(html).toContain("Say how long.");
    expect(html).toContain("Comment 2");
    expect(html.match(/<li/g)).toHaveLength(2);
  });

  test("an entry with a delete callback has Delete, and one without has none", () => {
    const html = renderToStaticMarkup(
      <AnnotationList
        heading="h"
        entries={[
          { id: "u-1", label: "A", excerpt: "x", onDelete: NONE },
          { id: "u-2", label: "B", excerpt: "y" },
        ]}
      />,
    );
    expect(html.match(/>Delete<\/button>/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Delete A"');
  });

  test("an empty list shows nothing", () => {
    expect(renderToStaticMarkup(<AnnotationList heading="h" entries={[]} />)).toBe("");
  });

  test("shows a note under the heading when given", () => {
    const html = renderToStaticMarkup(
      <AnnotationList
        heading="h"
        note="Delete them before you answer."
        entries={[{ id: "a", label: "A", excerpt: "x" }]}
      />,
    );
    expect(html).toContain("Delete them before you answer.");
  });

  test("text is text, never markup, and a 200-character word wraps", () => {
    const word = "q".repeat(200);
    const html = renderToStaticMarkup(
      <AnnotationList
        heading="h"
        entries={[{ id: "a", label: word, excerpt: "<b>x</b>", text: word }]}
      />,
    );
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>");
    expect(html.match(/break-words/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
