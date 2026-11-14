import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CHECKBOX, SelectBox } from "./select-box.tsx";

// The check box of a selection column, shared by the Tree and the Ranking (keyboard-shortcuts-help,
// design decision 8): a native check box out of the Tab order, named by the caller. The handlers
// are the caller's; the browser scenarios of both widgets check them.
describe("the shared selection check box", () => {
  test("is a native check box out of the Tab order, named by its caller", () => {
    const html = renderToStaticMarkup(<SelectBox state="none" label="Select Speed" node="speed" />);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-label="Select Speed"');
    expect(html).toContain('data-select="speed"');
    expect(html).toContain('data-interactive=""');
    expect(html).not.toContain("checked");
  });

  test("is checked for a checked row, and a header's has the select-all mark", () => {
    const row = renderToStaticMarkup(<SelectBox state="checked" label="x" node="speed" />);
    expect(row).toContain("checked");
    const header = renderToStaticMarkup(<SelectBox state="none" label="all" node={undefined} />);
    expect(header).toContain('data-select-all=""');
    expect(header).not.toContain("data-select=");
  });

  test("takes the focus ring and the accent of the Tree's check box", () => {
    expect(CHECKBOX).toContain("accent-primary");
    expect(CHECKBOX).toContain("focus-visible:outline-ring");
  });

  // The element's props are read by calling the component: static markup runs no ref and no handler.
  const propsOf = (state: "checked" | "partial" | "none") =>
    (SelectBox({ state, label: "x", node: "a" }) as unknown as { props: Record<string, unknown> })
      .props;

  test("sets the DOM's indeterminate for a partial state only, and ignores a missing element", () => {
    for (const [state, indeterminate] of [
      ["partial", true],
      ["checked", false],
      ["none", false],
    ] as const) {
      const box = { indeterminate: !indeterminate };
      (propsOf(state).ref as (box: unknown) => void)(box);
      expect(box.indeterminate).toBe(indeterminate);
    }
    expect(() => (propsOf("none").ref as (box: null) => void)(null)).not.toThrow();
  });

  test("changes nothing itself: its click and press handlers are the caller's", () => {
    expect((propsOf("none").onChange as () => unknown)()).toBeUndefined();
    const clicked: boolean[] = [];
    const pressed: string[] = [];
    const element = SelectBox({
      state: "none",
      label: "x",
      node: "a",
      onClick: (event) => clicked.push(event.shiftKey),
      onMouseDown: () => pressed.push("down"),
    }) as unknown as { props: { onClick: (event: object) => void; onMouseDown: () => void } };
    element.props.onClick({ shiftKey: true });
    element.props.onMouseDown();
    expect([clicked, pressed]).toEqual([[true], ["down"]]);
  });
});
