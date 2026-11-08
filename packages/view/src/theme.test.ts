import { describe, expect, test } from "bun:test";
import {
  applyDensity,
  applyTheme,
  followTheme,
  readTheme,
  resolveTheme,
  systemTheme,
} from "./theme.ts";

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

  test("only light and dark read as a theme", () => {
    expect(readTheme("dark")).toBe("dark");
    expect(readTheme("light")).toBe("light");
    for (const value of ["system", "", undefined, 1, {}]) expect(readTheme(value)).toBeUndefined();
  });
});

describe("the density class", () => {
  test("comfortable sets the class on the root and compact removes it", () => {
    const target = root();
    applyDensity(target, "comfortable");
    expect([...target.classes]).toEqual(["comfortable"]);
    applyDensity(target, "compact");
    expect([...target.classes]).toEqual([]);
  });

  test("the density and the theme classes are independent", () => {
    const target = root();
    applyTheme(target, "dark");
    applyDensity(target, "comfortable");
    applyDensity(target, "compact");
    expect([...target.classes]).toEqual(["dark"]);
  });
});

describe("the theme preference", () => {
  test("system follows the system's scheme; light and dark ignore it", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  test("a followed preference applies the resolved theme now and on each system change", () => {
    const { list, change } = media(false);
    const applied: string[] = [];
    const follower = followTheme(list, (theme) => applied.push(theme));
    expect(applied).toEqual(["light"]);
    change(true);
    expect(applied).toEqual(["light", "dark"]);
    expect(follower.current()).toBe("dark");
    follower.prefer("light");
    expect(applied).toEqual(["light", "dark", "light"]);
    change(false);
    change(true);
    expect(applied).toEqual(["light", "dark", "light"]);
    expect(follower.current()).toBe("light");
    follower.prefer("system");
    expect(applied.at(-1)).toBe("dark");
  });
});
