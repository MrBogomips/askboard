import { describe, expect, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcceptAsIsButton } from "./accept-as-sent-button.tsx";

// The "Accept as is" button (accept-as-sent, design decision 1; view-and-widgets spec: When Accept
// as is is offered): a secondary button named and described by the strings the row gives it, with
// no key of its own.
const base = {
  disabled: false,
  onAccept: () => {},
  label: "Accept as is",
  hint: "Answers with the content as the agent sent it.",
  hintId: "hint-1",
};
const draw = (over: Partial<typeof base> = {}) =>
  renderToStaticMarkup(createElement(AcceptAsIsButton, { ...base, ...over }));

describe("the Accept as is button", () => {
  test("is a plain button named by its label, described by its hint, with no key of its own", () => {
    const html = draw();
    expect(html).toContain("data-askboard-accept-as-is");
    expect(html).toContain(">Accept as is<");
    expect(html).toContain('aria-describedby="hint-1"');
    expect(html).toContain('id="hint-1"');
    expect(html).toContain("Answers with the content as the agent sent it.");
    expect(html).not.toContain("aria-keyshortcuts");
  });

  test("a disabled one is disabled", () => {
    expect(draw({ disabled: true })).toContain(' disabled=""');
    expect(draw()).not.toContain(' disabled=""');
  });

  test("a press gives the pressed button to onAccept", () => {
    const seen: unknown[] = [];
    const tree = AcceptAsIsButton({ ...base, onAccept: (control) => seen.push(control) });
    const button = (tree as ReactElement<{ children: ReactElement[] }>).props
      .children[0] as ReactElement<{ onClick: (event: unknown) => void }>;
    const control = {};
    button.props.onClick({ currentTarget: control });
    expect(seen).toEqual([control]);
  });
});
