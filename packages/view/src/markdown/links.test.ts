import { describe, expect, test } from "bun:test";
import { anchorHref, type LinkEvent, linkAction, markExternal, mountMarkdown } from "./links.ts";

// What a click on a link in Markdown does (atoms, view-and-widgets spec: Markdown links in the
// view). The DOM reads are structural, so a stand-in element is enough here; the browser file
// `text.browser.ts` runs the real clicks.

type Stand = {
  readonly name: string;
  readonly href?: string;
  readonly parent?: Stand;
};

const standIn = (node: Stand) => ({
  closest: (selector: string): unknown => {
    if (selector !== "a[href]") throw new Error("only anchors with an href are looked for");
    for (let at: Stand | undefined = node; at !== undefined; at = at.parent) {
      if (at.name === "a" && at.href !== undefined) return { getAttribute: () => at.href ?? null };
    }
    return null;
  },
});

const inside = { contains: () => true };
const outside = { contains: () => false };

describe("the anchor a click landed on", () => {
  test("an anchor with an href, or an element inside one, gives its href", () => {
    const anchor: Stand = { name: "a", href: "https://example.com/docs" };
    expect(anchorHref(standIn(anchor), inside)).toBe("https://example.com/docs");
    expect(anchorHref(standIn({ name: "code", parent: anchor }), inside)).toBe(
      "https://example.com/docs",
    );
  });

  test("the href is the attribute as the sanitizer kept it, never the resolved `href` property", () => {
    const anchor = { getAttribute: () => "https://example.com/docs", href: "http://board.test/" };
    const target = { closest: () => anchor };
    expect(anchorHref(target, inside)).toBe("https://example.com/docs");
    const none = { getAttribute: () => null, href: "http://board.test/" };
    expect(anchorHref({ closest: () => none }, inside)).toBeUndefined();
  });

  test("an element outside an anchor, one with no href, a missing target and a foreign anchor give none", () => {
    expect(anchorHref(standIn({ name: "p" }), inside)).toBeUndefined();
    expect(anchorHref(standIn({ name: "a" }), inside)).toBeUndefined();
    expect(anchorHref(null, inside)).toBeUndefined();
    expect(anchorHref({}, inside)).toBeUndefined();
    expect(
      anchorHref(standIn({ name: "a", href: "https://example.com/" }), outside),
    ).toBeUndefined();
  });
});

describe("what a click or an auxclick does", () => {
  test("on the board a click is prevented and asks the page to open the link", () => {
    expect(linkAction("click", true)).toEqual({ prevent: true, open: true });
  });

  test("on the board an auxclick is prevented and opens nothing", () => {
    expect(linkAction("auxclick", true)).toEqual({ prevent: true, open: false });
  });

  test("in a Snapshot the browser opens the link itself: nothing is prevented or asked", () => {
    expect(linkAction("click", false)).toEqual({ prevent: false, open: false });
    expect(linkAction("auxclick", false)).toEqual({ prevent: false, open: false });
  });
});

describe("links in a Snapshot", () => {
  const anchors = () => {
    const set: Record<string, string>[] = [{}, {}];
    return {
      set,
      root: {
        querySelectorAll: (selector: string) => {
          if (selector !== "a") throw new Error("anchors only");
          return set.map((attributes) => ({
            setAttribute: (name: string, value: string) => {
              attributes[name] = value;
            },
          }));
        },
      },
    };
  };

  test("each anchor opens in a new tab without an opener or a referrer", () => {
    const { set, root } = anchors();
    markExternal(root);
    expect(set).toEqual(
      Array.from({ length: 2 }, () => ({ target: "_blank", rel: "noopener noreferrer" })),
    );
  });
});

describe("mounting Markdown in its container", () => {
  const container = () => {
    const listeners = new Map<string, (event: LinkEvent) => void>();
    const placed: unknown[] = [];
    const anchor = { getAttribute: () => "https://example.com/docs" };
    const target = {
      contains: () => true,
      replaceChildren: (node: unknown) => placed.push(node),
      addEventListener: (type: string, listener: (event: LinkEvent) => void) =>
        listeners.set(type, listener),
      removeEventListener: (type: string) => listeners.delete(type),
    };
    const onAnchor = {
      target: { closest: () => anchor },
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    const onText = {
      target: { closest: () => null },
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    return { listeners, placed, target, onAnchor, onText };
  };

  test("on the board a click is prevented and opens the link naming the item; an auxclick is only prevented", () => {
    const { listeners, placed, target, onAnchor, onText } = container();
    const opened: string[] = [];
    const undo = mountMarkdown({
      target,
      shown: "content",
      hosted: true,
      itemId: "intro",
      openLink: (id, url) => opened.push(`${id} ${url}`),
    });
    expect(placed).toEqual(["content"]);
    listeners.get("click")?.(onText);
    expect(onText.prevented).toBe(false);
    listeners.get("click")?.(onAnchor);
    expect(onAnchor.prevented).toBe(true);
    expect(opened).toEqual(["intro https://example.com/docs"]);
    const middle = container().onAnchor;
    listeners.get("auxclick")?.(middle);
    expect(middle.prevented).toBe(true);
    expect(opened).toHaveLength(1);
    undo();
    expect([...listeners.keys()]).toEqual([]);
  });

  test("in a Snapshot nothing is prevented and nothing is asked", () => {
    const { listeners, target, onAnchor } = container();
    const opened: string[] = [];
    mountMarkdown({
      target,
      shown: "content",
      hosted: false,
      itemId: "intro",
      openLink: (id, url) => opened.push(`${id} ${url}`),
    });
    listeners.get("click")?.(onAnchor);
    expect(onAnchor.prevented).toBe(false);
    expect(opened).toEqual([]);
  });
});
