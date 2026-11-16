import { describe, expect, test } from "bun:test";
import {
  applyDensity,
  applyPalette,
  applyTheme,
  CONTRAST_QUERY,
  followPalette,
  followTheme,
  readTheme,
  resolvePalette,
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

// The palette (palettes, task 3.1, design decision D5): `data-palette` on the root, Contrasto under
// the theme's System when the system asks for more contrast.
const attributes = () => {
  const values = new Map<string, string>();
  return {
    values,
    setAttribute: (name: string, value: string) => void values.set(name, value),
    removeAttribute: (name: string) => void values.delete(name),
  };
};

describe("resolving the palette", () => {
  const PALETTES = ["carta", "nordico", "grafite", "contrasto"] as const;

  test("under System, more contrast gives Contrasto whatever the palette", () => {
    for (const palette of PALETTES)
      expect(resolvePalette(palette, "system", true)).toBe("contrasto");
  });

  test("under System with no request, and under Light or Dark, the palette stays", () => {
    for (const palette of PALETTES) {
      expect(resolvePalette(palette, "system", false)).toBe(palette);
      for (const theme of ["light", "dark"] as const) {
        expect(resolvePalette(palette, theme, true)).toBe(palette);
        expect(resolvePalette(palette, theme, false)).toBe(palette);
      }
    }
  });

  test("the contrast query is prefers-contrast: more", () => {
    expect(CONTRAST_QUERY).toBe("(prefers-contrast: more)");
  });
});

describe("applying the palette", () => {
  test("sets data-palette for a named palette and removes it for Carta", () => {
    const element = attributes();
    applyPalette(element, "grafite");
    expect(element.values.get("data-palette")).toBe("grafite");
    applyPalette(element, "carta");
    expect(element.values.has("data-palette")).toBe(false);
  });

  test("a name the contract does not list reaches no attribute", () => {
    const element = attributes();
    applyPalette(element, 'carta"] body{' as never);
    applyPalette(element, "inchiostro" as never);
    expect(element.values.size).toBe(0);
    applyPalette(element, "nordico");
    applyPalette(element, "inchiostro" as never);
    expect(element.values.has("data-palette")).toBe(false);
  });
});

describe("following the palette", () => {
  test("applies at once, then on each preference and each change of the system's contrast", () => {
    const { list, change } = media(false);
    const applied: string[] = [];
    const follower = followPalette(list, (palette) => applied.push(palette));
    expect(applied).toEqual(["carta"]);
    follower.prefer("nordico", "system");
    expect(applied.at(-1)).toBe("nordico");
    change(true);
    expect(applied.at(-1)).toBe("contrasto");
    expect(follower.current()).toBe("contrasto");
    change(false);
    expect(applied.at(-1)).toBe("nordico");
  });

  test("an explicit theme ignores the system's contrast, and the system stops asking", () => {
    const { list, change } = media(true);
    const applied: string[] = [];
    const follower = followPalette(list, (palette) => applied.push(palette));
    expect(applied).toEqual(["contrasto"]);
    follower.prefer("grafite", "dark");
    expect(follower.current()).toBe("grafite");
    change(false);
    follower.prefer("grafite", "system");
    expect(follower.current()).toBe("grafite");
    change(true);
    expect(follower.current()).toBe("contrasto");
  });

  test("a change of the system under an explicit theme applies nothing new", () => {
    const { list, change } = media(false);
    const applied: string[] = [];
    const follower = followPalette(list, (palette) => applied.push(palette));
    follower.prefer("nordico", "light");
    const before = applied.length;
    change(true);
    expect(applied.length).toBe(before);
  });
});
