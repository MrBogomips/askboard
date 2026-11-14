// The key-override notation (keyboard-shortcuts-help, task 8.1; contract spec: The key-override
// notation; design decision 17): `Mod`, `Alt` and `Shift`, each at most once, joined by `+` to a key
// name. `parseKeyCombination` gives the binding or why not and never throws; `keyCombinationText`
// writes a binding back in the notation's own order (Mod, Alt, Shift).

import { describe, expect, test } from "bun:test";
import {
  KEY_VOCABULARY,
  type KeyBinding,
  type KeyHold,
  keyBinding,
  keyCombinationText,
  parseKeyCombination,
} from "../src/index.ts";

const read = (text: unknown): KeyBinding => {
  const result = parseKeyCombination(text);
  if (!result.ok) throw new Error(`refused ${JSON.stringify(text)}: ${result.reason}`);
  return result.binding;
};

const refused = (text: unknown): string => {
  const result = parseKeyCombination(text);
  if (result.ok)
    throw new Error(`read ${JSON.stringify(text)} as ${JSON.stringify(result.binding)}`);
  return result.reason;
};

describe("parseKeyCombination reads each hold's form", () => {
  test.each<[string, string, KeyHold]>([
    ["ArrowUp", "ArrowUp", "none"],
    ["Shift+ArrowUp", "ArrowUp", "shift"],
    ["Alt+Shift+Home", "Home", "alt+shift"],
    ["Mod+z", "z", "mod"],
    ["Mod+Shift+Enter", "Enter", "mod+shift"],
    ["?", "?", "char"],
    ["%", "%", "char"],
    ["Mod+Alt+ArrowUp", "ArrowUp", "mod+alt"],
    ["Escape", "Escape", "none"],
    ["F2", "F2", "none"],
    ["Delete", "Delete", "none"],
  ])("%s", (text, key, hold) => {
    expect(read(text)).toEqual({ key, hold });
  });

  test("modifiers in any order", () => {
    expect(read("Shift+Alt+Home")).toEqual(keyBinding("Home", "alt+shift"));
    expect(read("Shift+Mod+Enter")).toEqual(keyBinding("Enter", "mod+shift"));
    expect(read("Alt+Mod+ArrowDown")).toEqual(keyBinding("ArrowDown", "mod+alt"));
  });

  test("Space is the space bar", () => {
    expect(read("Space")).toEqual(keyBinding(" "));
    expect(read("Shift+Space")).toEqual(keyBinding(" ", "shift"));
  });

  test("a letter in either case is the letter in lower case", () => {
    expect(read("Mod+Z")).toEqual(keyBinding("z", "mod"));
    expect(read("Mod+z")).toEqual(keyBinding("z", "mod"));
    expect(read("K")).toEqual(keyBinding("k"));
  });

  test("every key the vocabulary binds is read", () => {
    for (const { keys } of Object.values(KEY_VOCABULARY)) {
      for (const binding of keys) {
        expect(read(keyCombinationText(binding))).toEqual(binding);
      }
    }
  });
});

describe("parseKeyCombination refuses, with a reason", () => {
  test("an empty text, a lone or trailing +, an empty part", () => {
    expect(refused("")).toContain("empty");
    expect(refused("+")).toContain("+");
    expect(refused("Shift+")).toContain("+");
    expect(refused("+ArrowUp")).toContain("+");
    expect(refused("Shift++ArrowUp")).toContain("+");
  });

  test("a modifier twice, naming it", () => {
    expect(refused("Shift+Shift+ArrowUp")).toContain("Shift");
    expect(refused("Mod+Alt+Mod+ArrowUp")).toContain("Mod");
  });

  test.each(["Ctrl", "Cmd", "Meta", "Option", "AltGraph", "Control", "Super"])(
    "%s is no modifier of the notation, and the reason names it",
    (name) => {
      expect(refused(`${name}+ArrowUp`)).toContain(name);
      expect(refused(`Alt+${name}+ArrowUp`)).toContain(name);
    },
  );

  test("Ctrl+Alt+ArrowUp, the spec's scenario", () => {
    expect(refused("Ctrl+Alt+ArrowUp")).toContain("Ctrl");
  });

  test("a modifier alone is no key", () => {
    expect(refused("Shift")).toContain("Shift");
    expect(refused("Mod")).toContain("Mod");
  });

  test("Shift with ? or %, and any modifier with a printed character", () => {
    expect(refused("Shift+?")).toContain("?");
    expect(refused("Shift+%")).toContain("%");
    expect(refused("Mod+?")).toContain("?");
    expect(refused("Alt+Shift+%")).toContain("%");
  });

  test("a hold that no binding has: Alt alone, Mod with Alt and Shift", () => {
    expect(refused("Alt+ArrowUp")).toContain("Alt+ArrowUp");
    expect(refused("Mod+Alt+Shift+ArrowUp")).toContain("Mod+Alt+Shift");
  });

  test("a text over 32 characters", () => {
    const long = `Mod+${"a".repeat(29)}`;
    expect(long).toHaveLength(33);
    expect(refused(long)).toContain("32");
    expect(parseKeyCombination("Mod+Alt+Shift+ArrowDown".padEnd(32, "x")).ok).toBe(false);
  });

  test("a key that is no name of the notation", () => {
    expect(refused("arrowup")).toContain("arrowup");
    expect(refused("1")).toContain("1");
    expect(refused("$")).toContain("$");
    expect(refused("ArrowUpx")).toContain("ArrowUpx");
    expect(refused("F13")).toContain("F13");
    expect(refused("__proto__")).toContain("__proto__");
    expect(refused("constructor")).toContain("constructor");
    expect(refused(" ")).toBeDefined();
  });

  test("a value that is no text never throws", () => {
    for (const value of [undefined, null, 1, true, {}, [], ["ArrowUp"], Symbol.for("x")]) {
      expect(refused(value)).toContain("text");
    }
  });
});

describe("parseKeyCombination classes its refusal: notation, or hold", () => {
  const ruleOf = (text: unknown): string => {
    const result = parseKeyCombination(text);
    if (result.ok) throw new Error(`read ${JSON.stringify(text)}`);
    return result.rule;
  };

  test("a set of modifiers no hold has, or a modifier on a printed character, is `hold`", () => {
    expect(ruleOf("Alt+ArrowUp")).toBe("hold");
    expect(ruleOf("Alt+Home")).toBe("hold");
    expect(ruleOf("Mod+Alt+Shift+ArrowUp")).toBe("hold");
    expect(ruleOf("Shift+?")).toBe("hold");
    expect(ruleOf("Mod+%")).toBe("hold");
  });

  test("anything else that is no combination is `notation`", () => {
    for (const text of ["", "+", "Shift+", "Ctrl+ArrowUp", "Shift+Shift+Home", "1", "arrowup", 7]) {
      expect(ruleOf(text)).toBe("notation");
    }
    expect(ruleOf(`Mod+${"a".repeat(40)}`)).toBe("notation");
  });
});

describe("keyCombinationText writes back what it read", () => {
  test.each([
    "ArrowUp",
    "Shift+ArrowUp",
    "Alt+Shift+Home",
    "Mod+z",
    "Mod+Shift+Enter",
    "?",
    "%",
    "Mod+Alt+ArrowUp",
    "Space",
    "F2",
    "Escape",
  ])("%s", (text) => {
    expect(keyCombinationText(read(text))).toBe(text);
  });

  test("in the order Mod, Alt, Shift, with a letter in lower case", () => {
    expect(keyCombinationText(read("Shift+Alt+Home"))).toBe("Alt+Shift+Home");
    expect(keyCombinationText(read("Shift+Mod+Enter"))).toBe("Mod+Shift+Enter");
    expect(keyCombinationText(read("Alt+Mod+End"))).toBe("Mod+Alt+End");
    expect(keyCombinationText(read("Mod+Z"))).toBe("Mod+z");
  });
});
