import { describe, expect, test } from "bun:test";
import { draw } from "../../../test/atoms/draw.ts";
import { componentFacts, componentFor } from "../port.ts";
import "./index.tsx";

// The Toggle atom drawn by the server renderer (atoms, task 5.3; view-and-widgets spec: The Toggle's
// unset state; design decision 7): a switch drawn off with "Not set" while unset, "On" or "Off" once
// pressed with a "Clear" button, read-only once answered. Presses and keys are `field-atoms.browser.ts`'s.

const toggle = (props: unknown, options = {}) =>
  draw(componentFor("toggle"), "toggle", props, options);

describe("the Toggle's markup", () => {
  test("registers under its type", () => {
    expect(componentFor("toggle")).toBeDefined();
  });

  test("unset: a switch drawn off, Not set beside it, no Clear", () => {
    const { html } = toggle({ label: "Notify me" });
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Not set");
    expect(html).not.toContain("Clear");
    expect(html).not.toContain(">On<");
    expect(html).not.toContain(">Off<");
  });

  test("on: the switch checked, On beside it, and Clear", () => {
    const { html } = toggle({ label: "Notify me" }, { result: true });
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain(">On<");
    expect(html).toContain(">Clear<");
    expect(html).not.toContain("Not set");
  });

  test("off, which is an answer: the switch unchecked, Off beside it, and Clear", () => {
    const { html } = toggle({ label: "Notify me" }, { result: false });
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain(">Off<");
    expect(html).toContain(">Clear<");
    expect(html).not.toContain("Not set");
  });

  test("the label is visible and names the switch, the description under it describes it", () => {
    const { html } = toggle({ label: "Notify me", description: "One message." });
    expect(html).toMatch(/<label[^>]*>Notify me<\/label>/);
    expect(html).toContain("One message.");
    expect(html).toMatch(/aria-labelledby="atom:label"/);
    expect(html).toMatch(/aria-describedby="[^"]*atom:description[^"]*"/);
    expect(html.indexOf("Notify me")).toBeLessThan(html.indexOf("One message."));
  });

  test("read-only after an answer: the switch disabled, the state as text, no Clear", () => {
    const set = toggle({ label: "L" }, { result: true, disabled: true }).html;
    expect(set).toContain(">On<");
    expect(set).toContain("disabled");
    expect(set).not.toContain("Clear");
    const unset = toggle({ label: "L" }, { disabled: true }).html;
    expect(unset).toContain("Not set");
    expect(unset).not.toContain("Clear");
  });

  test("in Italian: Non impostato, Attivo, Disattivo and Cancella", () => {
    expect(toggle({ label: "L" }, { locale: "it-IT" }).html).toContain("Non impostato");
    const on = toggle({ label: "L" }, { result: true, locale: "it-IT" }).html;
    expect(on).toContain(">Attivo<");
    expect(on).toContain(">Cancella<");
    expect(toggle({ label: "L" }, { result: false, locale: "it-IT" }).html).toContain(
      ">Disattivo<",
    );
  });

  test("a result that is no boolean shows as unset", () => {
    expect(toggle({ label: "L" }, { result: "yes" }).html).toContain("Not set");
    expect(toggle({ label: "L" }, { result: 1 }).html).toContain("Not set");
  });

  test("a label is text, never markup, and props the contract refuses fail the item", () => {
    expect(toggle({ label: "<b>L</b>" }).html).toContain("&lt;b&gt;L&lt;/b&gt;");
    expect(() => toggle({})).toThrow('the Toggle "atom" refuses its props');
    expect(() => toggle({ label: "L", on: true })).toThrow("on");
  });
});

describe("the Toggle's facts", () => {
  test("its name in the agent-change notice, and a boolean is the one result that fits", () => {
    const facts = componentFacts("toggle");
    expect(facts?.name).toBe("change.widgetToggle");
    expect(facts?.fits?.(true, {})).toBe(true);
    expect(facts?.fits?.(false, {})).toBe(true);
    for (const result of ["true", 1, null, undefined, {}]) {
      expect(facts?.fits?.(result, {}), String(result)).toBe(false);
    }
  });
});
