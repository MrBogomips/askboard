import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ChoiceExtras, ChoiceProps } from "./props.ts";
import { SingleChoice } from "./single-choice.tsx";

// The question's single Choice drawn by the server renderer (choice-documented-activation, task
// 1.2; view-and-widgets spec: Radios with manual activation). Its keys, focus and draft in a
// browser are `board.browser.ts`, `lifecycle-card.browser.ts` and `lifecycle-keyboard.browser.ts`.

Object.assign(globalThis, { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} });

const NONE = () => {};
const extras = (
  other: string | undefined,
  optionNotes: Readonly<Record<string, string>> = {},
): ChoiceExtras => ({
  other,
  onOtherChange: NONE,
  optionNotes,
  onOptionNoteChange: NONE,
});

const draw = (
  given: {
    readonly value?: readonly string[];
    readonly disabled?: boolean;
    readonly other?: string;
    readonly allowOther?: boolean;
    readonly notes?: Readonly<Record<string, string>>;
    readonly extra?: Readonly<Record<string, unknown>>;
    readonly previewOpen?: boolean;
  } = {},
): string =>
  renderToStaticMarkup(
    createElement(SingleChoice, {
      item: {
        id: "database",
        type: "question",
        rev: 1,
        props: {
          text: "Which database?",
          options: [
            {
              label: "PostgreSQL",
              description: "Relational.",
              annotation: "The team runs it.",
              preview: "Strong consistency.",
            },
            { label: "SQLite" },
            { label: "DynamoDB" },
          ],
          ...(given.allowOther === false ? {} : { allowOther: true }),
        },
      },
      value: given.value,
      onValueChange: NONE,
      disabled: given.disabled ?? false,
      extras: extras(given.other, given.notes),
    } as unknown as ChoiceProps),
  );

const radios = (html: string): string[] => html.match(/<button[^>]*role="radio"[^>]*>/g) ?? [];

describe("a single Choice's markup", () => {
  test("one radio group named by the question text, a radio per option and one for Other, none checked", () => {
    const html = draw();
    expect(html).toMatch(/role="radiogroup"[^>]*aria-labelledby="database:text"/);
    const found = radios(html);
    expect(found).toHaveLength(4);
    for (const radio of found) expect(radio).toContain('aria-checked="false"');
    expect(html).not.toContain('aria-checked="true"');
  });

  test("each radio is a button named by its label, and described by its description", () => {
    const found = radios(draw());
    expect(found[0]).toContain('aria-labelledby="database:option:0:label"');
    expect(found[0]).toContain('aria-describedby="database:option:0:description"');
    expect(found[1]).not.toContain("aria-describedby");
    expect(found[3]).toContain('aria-labelledby="database:other:label"');
    for (const radio of found) expect(radio).toContain('type="button"');
  });

  test("no Other row when the question does not offer it", () => {
    const html = draw({ allowOther: false });
    expect(radios(html)).toHaveLength(3);
    expect(html).not.toContain("database:other:label");
  });

  test("the first radio is the tab stop when nothing is chosen, and the group takes none", () => {
    const html = draw();
    const found = radios(html);
    expect(found[0]).toContain('tabindex="0"');
    for (const radio of found.slice(1)) expect(radio).toContain('tabindex="-1"');
    expect(html.match(/<div[^>]*role="radiogroup"[^>]*>/)?.[0]).not.toContain("tabindex");
  });

  test("the chosen option is the only one checked, the tab stop and shows its dot", () => {
    const html = draw({ value: ["SQLite"] });
    const found = radios(html);
    expect(found.filter((radio) => radio.includes('aria-checked="true"'))).toHaveLength(1);
    expect(found[1]).toContain('aria-checked="true"');
    expect(found[1]).toContain('data-state="checked"');
    expect(found[1]).toContain('tabindex="0"');
    expect(found[0]).toContain('tabindex="-1"');
    expect(html.match(/rounded-full bg-primary/g)).toHaveLength(1);
  });

  test("Other chosen is the checked radio, with its text field, and no option is", () => {
    const html = draw({ other: "Mongo" });
    const found = radios(html);
    expect(found[3]).toContain('aria-checked="true"');
    expect(found[3]).toContain('tabindex="0"');
    expect(found.slice(0, 3).join("")).not.toContain('aria-checked="true"');
    expect(html).toContain('value="Mongo"');
  });

  test("read-only, every radio is disabled with its checked state shown and no tab stop", () => {
    const html = draw({ value: ["SQLite"], disabled: true });
    const found = radios(html);
    for (const radio of found) {
      expect(radio).toContain("disabled");
      expect(radio).toContain('tabindex="-1"');
    }
    expect(found[1]).toContain('aria-checked="true"');
  });

  test("no element carries a style attribute (AD-8)", () => {
    expect(draw({ value: ["SQLite"], other: undefined })).not.toContain("style=");
    expect(draw({ other: "x", disabled: true })).not.toContain("style=");
  });

  test("agent text is shown as text, never as markup", () => {
    const html = renderToStaticMarkup(
      createElement(SingleChoice, {
        item: {
          id: "q",
          type: "question",
          rev: 1,
          props: {
            text: "t",
            options: [{ label: '<img src=x onerror="alert(1)">' }, { label: "b" }],
          },
        },
        value: undefined,
        onValueChange: NONE,
        disabled: false,
      } as unknown as ChoiceProps),
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("what sits under the radios", () => {
  test("the agent's annotation and a Show preview button come with their option, the preview closed", () => {
    const html = draw();
    expect(html).toContain("The team runs it.");
    expect(html).toMatch(/aria-expanded="false"[^>]*aria-controls="database:option:0:preview"/);
    expect(html).not.toContain("Strong consistency.");
  });

  test("the user's note on an option shows in its field, under that option", () => {
    const html = draw({ notes: { SQLite: "Fine for one writer." } });
    expect(html).toContain("Fine for one writer.");
    expect(html).toContain('aria-label="Your note on SQLite"');
  });

  test("read-only, no button to add a note", () => {
    expect(draw({ disabled: true })).not.toContain("Add your note");
    expect(draw()).toContain("Add your note");
  });
});
