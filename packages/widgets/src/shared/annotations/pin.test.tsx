import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Pin } from "./pin.tsx";

// The shared annotation pin (document-review, design decision 7; image-annotation's decision 9): a
// numbered button whose accessible name holds its number. Where it stands is the caller's.
describe("the pin", () => {
  test("is a button whose text is its number and whose accessible name holds it", () => {
    const html = renderToStaticMarkup(<Pin number={2} />);
    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).toContain(">2</button>");
    expect(html).toContain('aria-label="Pin 2"');
  });

  test("takes a name from the caller, which still holds the number", () => {
    const html = renderToStaticMarkup(<Pin number={3} label="Comment 3" />);
    expect(html).toContain('aria-label="Comment 3"');
  });

  test("passes the caller's attributes on, as an anchor and a button need", () => {
    const html = renderToStaticMarkup(<Pin number={1} aria-expanded={true} data-pin="x" />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('data-pin="x"');
  });

  test("is round, on the change colour, with a focus ring and a wider hit region", () => {
    const html = renderToStaticMarkup(<Pin number={1} />);
    expect(html).toContain("rounded-full");
    expect(html).toContain("bg-change");
    expect(html).toContain("text-change-foreground");
    expect(html).toContain("focus-visible:outline-ring");
  });
});
