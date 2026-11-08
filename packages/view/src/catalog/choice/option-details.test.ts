import { describe, expect, test } from "bun:test";
import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OptionDetails, OtherField } from "./option-details.tsx";
import type { ChoiceExtras } from "./props.ts";

// What sits under an option's row and the "Other…" text field, called inside a render so that
// their hooks work, and their handlers called as the browser would: the markup and the keys are
// `single-choice.test.ts`'s and the browser tests'. Setting state after a server render is a
// no-op, so a handler's call to a setter changes nothing here.

type Found = ReactElement<Record<string, unknown>>;
type Handler<T> = { onChange: (value: T) => void };

type Capture = { readonly run: () => unknown; value?: unknown };

const Capturing = ({ capture }: { readonly capture: Capture }) => {
  capture.value = capture.run();
  return null;
};

const inRender = <T>(run: () => T): T => {
  const capture: Capture = { run };
  renderToStaticMarkup(createElement(Capturing, { capture }));
  return capture.value as T;
};

const flatten = (node: unknown): Found[] => {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!isValidElement(node)) return [];
  const found = node as Found;
  return [found, ...flatten(found.props.children)];
};

const typed = (value: string) => ({ target: { value } });

describe("the Other text field", () => {
  test("hands each edit's text to onChange", () => {
    const seen: string[] = [];
    const field = inRender(() =>
      OtherField({ other: "a", disabled: false, onChange: (text) => seen.push(text) }),
    );
    (field.props as Handler<unknown>).onChange(typed("ab"));
    expect(seen).toEqual(["ab"]);
  });
});

describe("an option's details", () => {
  const notes: string[][] = [];
  const extras = (optionNotes: Record<string, string>): ChoiceExtras => ({
    other: undefined,
    onOtherChange: () => {},
    optionNotes,
    onOptionNoteChange: (label, note) => notes.push([label, note ?? "none"]),
  });
  const details = (optionNotes: Record<string, string>) =>
    inRender(() =>
      flatten(
        OptionDetails({
          itemId: "q",
          index: 0,
          option: { label: "SQLite" },
          selected: false,
          disabled: false,
          extras: extras(optionNotes),
          previewOpen: false,
          onPreview: () => {},
        }),
      ),
    );
  const noteField = (optionNotes: Record<string, string>) => {
    const field = details(optionNotes).find((each) => typeof each.type === "function");
    if (field === undefined) throw new Error("no note field");
    return field;
  };

  test("the add-note button's handler runs without error (that it opens the editor is the browser cases')", () => {
    const button = details({}).find((each) => each.type === "button");
    if (button === undefined) throw new Error("no button");
    expect((button.props as { onClick: () => void }).onClick()).toBeUndefined();
  });

  test("an edit of the note goes to the draft under the option's label", () => {
    (noteField({ SQLite: "first" }).props as Handler<string>).onChange("second");
    expect(notes).toContainEqual(["SQLite", "second"]);
  });

  test("the note's text area gives its text, and no text at all as no note", () => {
    const field = noteField({ SQLite: "first" });
    const given: (string | undefined)[] = [];
    const props = { ...field.props, onChange: (note: string | undefined) => given.push(note) };
    const area = inRender(() => (field.type as (props: unknown) => Found)(props));
    expect(area.type).toBe("textarea");
    (area.props as Handler<unknown>).onChange(typed(""));
    (area.props as Handler<unknown>).onChange(typed("kept"));
    expect(given).toEqual([undefined, "kept"]);
  });
});
