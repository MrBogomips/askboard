import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// The module's table: export name, Lucide icon (icon-set, design decision 3, DESIGN.md's Icons).
const TABLE = {
  IconNextOpen: "arrow-down",
  IconReplies: "message-square-reply",
  IconAgentChanged: "refresh-cw",
  IconExternal: "external-link",
  IconSelected: "check",
  IconClose: "x",
  IconCalendar: "calendar",
  IconDisclosure: "chevron-right",
  IconDragHandle: "grip-vertical",
} as const;

const loadIcons = (): Promise<Record<string, unknown>> => import("./index.ts");

const markup = async (name: string, props: Record<string, unknown> = {}) => {
  const icon = (await loadIcons())[name] as Parameters<typeof createElement>[0] | undefined;
  if (icon === undefined) throw new Error(`no export ${name}`);
  return renderToStaticMarkup(createElement(icon, props));
};

describe("the icon module", () => {
  test("exports the nine names of the table, no more and no fewer", async () => {
    expect(Object.keys(await loadIcons()).sort()).toEqual(Object.keys(TABLE).sort());
  });

  test.each(Object.entries(TABLE))(
    "%s is the default export of lucide-react/icons/%s",
    async (name, icon) => {
      const icons = await loadIcons();
      const lucide = (await import(`lucide-react/icons/${icon}`)) as { default: unknown };
      expect(icons[name]).toBe(lucide.default);
    },
  );

  test("an icon is hidden from assistive technology, draws in the text colour and sets no style", async () => {
    const html = await markup("IconClose");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).not.toContain("style=");
  });

  test("a role and a label make it a named image, no longer hidden", async () => {
    const html = await markup("IconClose", { role: "img", "aria-label": "Close" });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Close"');
    expect(html).not.toContain("aria-hidden");
  });

  test("the caller's class lands on the svg", async () => {
    expect(await markup("IconClose", { className: "size-4" })).toMatch(
      /<svg[^>]*class="[^"]*size-4/,
    );
  });
});

// Task 5.2: no icon ships unused. Each export is imported by a source (not a test) of the view or
// the widgets, other than the module itself.
const SRC_DIRS = [join(import.meta.dir, ".."), join(import.meta.dir, "../../../widgets/src")];
const isSource = (file: string) =>
  /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.endsWith("icons/index.ts");

const sources = (): string[] =>
  SRC_DIRS.flatMap((dir) =>
    [...new Bun.Glob("**/*.{ts,tsx}").scanSync(dir)]
      .filter(isSource)
      .map((file) => readFileSync(join(dir, file), "utf8")),
  );

describe("every icon is used", () => {
  test("each export of the module is imported by a non-test source", async () => {
    const code = sources();
    const unused = Object.keys(await loadIcons()).filter(
      (name) => !code.some((source) => new RegExp(`\\b${name}\\b`).test(source)),
    );
    expect(unused).toEqual([]);
  });
});
