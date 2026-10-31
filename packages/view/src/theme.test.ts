import { describe, expect, test } from "bun:test";
import { applyTheme, followSystemTheme, readTheme, systemTheme } from "./theme.ts";

// A media query list whose answer the test changes.
const media = (matches: boolean) => {
  const listeners: (() => void)[] = [];
  const list = {
    matches,
    addEventListener: (_type: "change", listener: () => void) => listeners.push(listener),
  };
  const change = (next: boolean) => {
    list.matches = next;
    for (const listener of listeners) listener();
  };
  return { list, change };
};

const root = () => {
  const classes = new Set<string>();
  return {
    classes,
    classList: {
      toggle: (name: string, force: boolean) => {
        if (force) classes.add(name);
        else classes.delete(name);
        return force;
      },
    },
  };
};

describe("the theme (EXPERIENCE.md, Dark theme)", () => {
  test("the system's preference picks light or dark", () => {
    expect(systemTheme({ matches: true })).toBe("dark");
    expect(systemTheme({ matches: false })).toBe("light");
  });

  test("dark sets the .dark class the tokens switch on, light removes it", () => {
    const element = root();
    applyTheme(element, "dark");
    expect([...element.classes]).toEqual(["dark"]);
    applyTheme(element, "light");
    expect([...element.classes]).toEqual([]);
  });

  test("following the system applies its theme now and on each change, and reads it", () => {
    const { list, change } = media(false);
    const seen: string[] = [];
    const current = followSystemTheme(list, (theme) => seen.push(theme));
    expect(seen).toEqual(["light"]);
    expect(current()).toBe("light");
    change(true);
    expect(seen).toEqual(["light", "dark"]);
    expect(current()).toBe("dark");
  });

  test("only light and dark read as a theme", () => {
    expect(readTheme("dark")).toBe("dark");
    expect(readTheme("light")).toBe("light");
    for (const value of ["system", "", undefined, 1, {}]) expect(readTheme(value)).toBeUndefined();
  });
});
