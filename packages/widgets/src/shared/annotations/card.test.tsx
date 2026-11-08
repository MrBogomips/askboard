import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Card, CardBody, type CardBodyProps } from "./card.tsx";
import { Pin } from "./pin.tsx";

// The shared annotation card (document-review, design decisions 7 and 9): a header label from the
// caller, the comment field, an optional suggested-edit field, optional "Edit" and "Delete", a
// read-only mode, and callbacks it writes through as the user types. The popover around it (the
// pin as anchor, Escape, focus return) is measured in a browser, where Radix has a document.
const NONE = () => {};

const body = (over: Partial<CardBodyProps> = {}): string =>
  renderToStaticMarkup(
    <CardBody
      label="Pin 2"
      comment={{ value: "", onChange: NONE }}
      startEditing={true}
      onClose={NONE}
      {...over}
    />,
  );

describe("a comment-only card", () => {
  test("shows its header label, the comment field and no suggested-edit field", () => {
    const html = body();
    expect(html).toContain("Pin 2");
    expect(html).toContain("<textarea");
    expect(html).toContain("Your comment");
    expect(html).not.toContain("Replace with");
    expect(html.match(/<textarea/g)).toHaveLength(1);
  });

  test("holds what the user wrote, as text and never as markup", () => {
    const html = body({ comment: { value: "<img src=x onerror=1>&", onChange: NONE } });
    expect(html).toContain("&lt;img src=x onerror=1&gt;&amp;");
    expect(html).not.toContain("<img");
  });

  test("offers Done and Close while it is being written, and no Edit", () => {
    const html = body();
    expect(html).toContain(">Done</button>");
    expect(html).toContain('aria-label="Close"');
    expect(html).not.toContain(">Edit</button>");
  });

  test("caps the field at the caller's length", () => {
    expect(body({ comment: { value: "", onChange: NONE, max: 2000 } })).toContain(
      'maxLength="2000"',
    );
  });
});

describe("a card with a suggested edit", () => {
  const suggestion = { value: "unsent answers", onChange: NONE, max: 4000 };

  test("shows the replacement field above the note, labelled", () => {
    const html = body({ suggestion, comment: { value: "why", onChange: NONE } });
    expect(html.match(/<textarea/g)).toHaveLength(2);
    expect(html.indexOf("Replace with")).toBeLessThan(html.indexOf("Note (optional)"));
    expect(html).not.toContain("Your comment");
    expect(html).toContain("unsent answers");
    expect(html).toContain('maxLength="4000"');
  });
});

describe("a card on the user's own annotation, being read", () => {
  test("shows its text, with Edit and Delete beside the close control", () => {
    const html = body({
      startEditing: false,
      comment: { value: "Say how long.", onChange: NONE },
      onDelete: NONE,
    });
    expect(html).not.toContain("<textarea");
    expect(html).toContain("Say how long.");
    expect(html).toContain(">Edit</button>");
    expect(html).toContain(">Delete</button>");
    expect(html).not.toContain(">Done</button>");
  });

  test("shows a suggested edit's replacement as text under its label", () => {
    const html = body({
      startEditing: false,
      suggestion: { value: "plain", onChange: NONE },
      comment: { value: "", onChange: NONE },
      onDelete: NONE,
    });
    expect(html).toContain("Replace with");
    expect(html).toContain("plain");
  });
});

describe("a read-only card", () => {
  test("shows neither Edit nor Delete, and no field, whatever it is given", () => {
    const html = body({
      readOnly: true,
      startEditing: true,
      comment: { value: "kept", onChange: NONE },
      onDelete: NONE,
    });
    expect(html).toContain("kept");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain(">Edit</button>");
    expect(html).not.toContain(">Delete</button>");
    expect(html).not.toContain(">Done</button>");
    expect(html).toContain('aria-label="Close"');
  });
});

describe("a long unspaced word", () => {
  test("wraps in the label, the text and the fields", () => {
    const word = "w".repeat(200);
    const html = body({
      label: word,
      startEditing: false,
      suggestion: { value: word, onChange: NONE },
      comment: { value: word, onChange: NONE },
    });
    expect(html.match(/break-words/g)?.length).toBeGreaterThanOrEqual(3);
    const edit = body({ comment: { value: word, onChange: NONE } });
    expect(edit).toContain("break-words");
  });
});

describe("the card as a popover on its pin", () => {
  const popover = (open: boolean): string =>
    renderToStaticMarkup(
      <Card
        anchor={<Pin number={2} />}
        open={open}
        onOpenChange={NONE}
        returnFocus={() => null}
        label="Pin 2"
        comment={{ value: "", onChange: NONE }}
        startEditing={true}
        onClose={NONE}
      />,
    );

  test("draws the pin it anchors to, closed and open, and nothing of the card on the server", () => {
    for (const open of [false, true]) {
      const html = popover(open);
      expect(html).toContain('aria-label="Pin 2"');
      expect(html).toContain(">2</button>");
      expect(html).not.toContain("<textarea");
    }
  });
});
