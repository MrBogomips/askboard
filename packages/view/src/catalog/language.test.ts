import { describe, expect, test } from "bun:test";
import type { Locale } from "@askboard/contract";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext, useLanguage, useStrings } from "./port.ts";

// The port's language (settings-languages design decision 9): what the shell provides for the
// board is the language of every lookup made under it, the catalog components' included; en-US
// when nothing provides one.

const Probe = (): ReactNode => {
  const text = useStrings();
  return `${useLanguage()}: ${text("question.answer")} · ${text("thread.messages", { count: 2 })}`;
};

const rendered = (language?: Locale): string =>
  renderToStaticMarkup(
    language === undefined
      ? createElement(Probe)
      : createElement(LanguageContext.Provider, { value: language }, createElement(Probe)),
  );

describe("the port's language", () => {
  test("is en-US when nothing provides one", () => {
    expect(rendered()).toBe("en-US: Answer · 2 messages");
  });

  test("is the one the board provides", () => {
    expect(rendered("it-IT")).toBe("it-IT: Rispondi · 2 messaggi");
  });
});
