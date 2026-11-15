import { describe, expect, test } from "bun:test";
import { type BoardKeyScope, boardKeyScopeOf, scopeTargetOf } from "./board-key-scope.ts";

// Where the board's keys act (board-keys, design decision 2), over element stand-ins: a node has a
// tag, attributes and a parent, and `closest` reads a selector list of the forms the module uses.

type Node = {
  readonly tagName: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly parent: Node | null;
  readonly type?: string;
  closest(selector: string): Node | null;
  getAttribute(name: string): string | null;
};

const matches = (node: Node, simple: string): boolean => {
  const tag = /^[a-z]+/i.exec(simple)?.[0];
  if (tag !== undefined && node.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  for (const [, name, , , value] of simple.matchAll(/\[([\w-]+)(=("?)([^\]"]*)\3)?\]/g)) {
    const have = node.attrs[name ?? ""];
    if (have === undefined) return false;
    if (value !== undefined && have !== value) return false;
  }
  return true;
};

const make = (
  tagName: string,
  attrs: Record<string, string>,
  parent: Node | null,
  type?: string,
) => {
  const node: Node = {
    tagName: tagName.toUpperCase(),
    attrs,
    parent,
    ...(type === undefined ? {} : { type }),
    closest(selector) {
      const simples = selector.split(",").map((each) => each.trim());
      for (let at: Node | null = node; at !== null; at = at.parent) {
        if (simples.some((simple) => matches(at as Node, simple))) return at;
      }
      return null;
    },
    getAttribute: (name) => attrs[name] ?? null,
  };
  return node;
};

const body = make("body", {}, null);
const header = make("header", {}, body);
const card = (id: string) => make("section", { "data-askboard-question": id }, body);
const q1 = card("q1");
const own = make("div", { "data-askboard-item": "q1" }, q1);

const scope = (target: Node | null): BoardKeyScope => boardKeyScopeOf(target);

describe("none: the key is the control's", () => {
  test("a text input, a textarea and a textbox", () => {
    expect(scope(make("input", {}, own, "text"))).toBe("none");
    expect(scope(make("textarea", {}, q1))).toBe("none");
    expect(scope(make("div", { role: "textbox" }, own))).toBe("none");
  });

  test.each(["menu", "listbox", "combobox", "dialog", "alertdialog"])("inside a %s", (role) => {
    const popup = make("div", { role }, own);
    expect(scope(make("button", {}, popup))).toBe("none");
  });

  test("inside a select", () => {
    expect(scope(make("option", {}, make("select", {}, own)))).toBe("none");
  });

  test("inside a widget item of a card", () => {
    const widget = make("div", { "data-askboard-item": "grid-1" }, q1);
    expect(scope(make("button", {}, widget))).toBe("none");
    expect(scope(make("button", {}, make("div", {}, widget)))).toBe("none");
  });

  test("inside an item frame outside any card", () => {
    const frame = make("div", { "data-askboard-item": "context-1" }, body);
    expect(scope(make("button", {}, frame))).toBe("none");
  });

  test("no target", () => {
    expect(scope(null)).toBe("none");
  });
});

describe("card: the question's own controls", () => {
  test("an option inside the question's own item frame", () => {
    expect(scope(make("button", {}, own))).toEqual({ card: "q1" });
  });

  test("the card's heading and its Postpone, with no item frame", () => {
    expect(scope(make("h3", {}, q1))).toEqual({ card: "q1" });
    expect(scope(make("button", {}, make("div", {}, q1)))).toEqual({ card: "q1" });
  });
});

describe("board: everywhere else", () => {
  test("a link inside a card", () => {
    expect(scope(make("a", { href: "https://example.org" }, q1))).toBe("board");
    expect(scope(make("span", {}, make("a", { href: "#x" }, own)))).toBe("board");
  });

  test("an element inside a card's thread", () => {
    const thread = make("section", { "data-askboard-thread": "" }, q1);
    expect(scope(make("button", {}, thread))).toBe("board");
  });

  test("the body and the header's buttons", () => {
    expect(scope(body)).toBe("board");
    expect(scope(make("button", {}, header))).toBe("board");
  });

  test("an anchor with no href is no link", () => {
    expect(scope(make("a", {}, q1))).toEqual({ card: "q1" });
  });
});

describe("scopeTargetOf: the element a key press is read from", () => {
  test("an element, HTML or not, is its own target: an SVG inside a widget item gives none", () => {
    const widget = make("div", { "data-askboard-item": "grid-1" }, q1);
    const svg = make("svg", {}, widget);
    expect(scopeTargetOf(svg, body)).toBe(svg);
    expect(scope(scopeTargetOf(svg, body) as Node)).toBe("none");
    expect(scope(scopeTargetOf(make("math", {}, widget), body) as Node)).toBe("none");
  });

  test("a target with no `closest` (the document, the window, a text node, nothing) is the body", () => {
    for (const target of [null, undefined, {}, { nodeType: 9 }, "x"]) {
      expect(scopeTargetOf(target, body)).toBe(body);
    }
    expect(scope(scopeTargetOf(null, body) as Node)).toBe("board");
  });
});
