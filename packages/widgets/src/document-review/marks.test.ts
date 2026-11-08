import { describe, expect, test } from "bun:test";
import { type DocumentReviewAnnotation, placeAnnotations } from "@askboard/contract";
import { el, type FakeNode, fakeDocument, fragment, show } from "../../test/fake-dom.ts";
import { applyMarks, markSpecs, reuseSlots, samePlan, setReplacements } from "./marks.ts";
import { layoutOf, type ReadingNode, readingTextOf } from "./reading.ts";

// The marks (document-review, design decision 7): the plan of the placed annotations and its
// application to a clone of the document, in fake nodes whose `innerHTML` and `style` attribute
// throw, since neither may ever be used.
const note = (
  id: string,
  exact: string,
  body: DocumentReviewAnnotation["body"] = { text: "t" },
) => ({
  id,
  target: { selector: { type: "quote" as const, exact } },
  body,
});

const specsOf = (text: string, annotations: readonly DocumentReviewAnnotation[]) =>
  markSpecs(placeAnnotations(text, annotations), annotations);

const documentOf = () =>
  fragment(
    el("p", {}, "The ", el("strong", {}, "bold run"), " goes on."),
    "\n",
    el("p", {}, "Second paragraph here."),
  );

describe("the plan", () => {
  const text = "The bold run goes on.\nSecond paragraph here.";

  test("lists the placed annotations in the document's order, numbered from 1", () => {
    const specs = specsOf(text, [note("u-2", "Second"), note("u-1", "bold")]);
    expect(specs.map(({ id, number }) => [id, number])).toEqual([
      ["u-1", 1],
      ["u-2", 2],
    ]);
    expect(specs[0]).toMatchObject({ start: 4, end: 8, suggested: false, replacement: "" });
  });

  test("leaves a detached annotation out, and the numbers count placed ones only", () => {
    const specs = specsOf(text, [note("u-1", "nowhere"), note("u-2", "paragraph")]);
    expect(specs.map(({ id, number }) => [id, number])).toEqual([["u-2", 1]]);
  });

  test("a suggestion carries its replacement, an empty one included", () => {
    const [kept, deleted] = specsOf(text, [
      note("u-1", "bold", { replacement: "plain" }),
      note("u-2", "Second", { replacement: "" }),
    ]);
    expect(kept).toMatchObject({ suggested: true, replacement: "plain" });
    expect(deleted).toMatchObject({ suggested: true, replacement: "" });
  });

  test("is the same plan while the places and kinds are, whatever the bodies say", () => {
    const one = specsOf(text, [note("u-1", "bold", { replacement: "a" })]);
    const typed = specsOf(text, [note("u-1", "bold", { replacement: "ab" })]);
    const commented = specsOf(text, [note("u-1", "bold", { text: "x" })]);
    const moved = specsOf(text, [note("u-1", "run")]);
    expect(samePlan(one, typed)).toBe(true);
    expect(samePlan(one, commented)).toBe(false);
    expect(samePlan(one, moved)).toBe(false);
    expect(samePlan(one, [])).toBe(false);
    expect(samePlan([], [])).toBe(true);
  });

  test("an unreadable annotation list entry is never a throw", () => {
    const places = placeAnnotations(text, [null as never, 3 as never, note("u-1", "bold")]);
    expect(() => markSpecs(places, [null as never, 3 as never, note("u-1", "bold")])).not.toThrow();
  });
});

describe("applying the plan", () => {
  const apply = (annotations: readonly DocumentReviewAnnotation[], root = documentOf()) => {
    const text = readingTextOf(root);
    const doc = fakeDocument();
    const marked = applyMarks(root, specsOf(text, annotations), doc);
    return { root, doc, marked, text };
  };

  test("wraps each text node segment of a passage across a bold run and two paragraphs", () => {
    const { root, text } = apply([note("u-1", "run goes on.\nSecond")]);
    const html = show(root);
    expect(html).toContain("data-review-mark=u-1>run</span>");
    expect(html).toContain("data-review-mark=u-1> goes on.</span>");
    expect(html).toContain("data-review-mark=u-1>Second</span>");
    // The line feed between the two paragraphs stands in the root and is no content: no mark.
    expect(html.match(/data-review-mark=u-1>/g)).toHaveLength(3);
    expect(readingTextOf(root)).toBe(text);
  });

  test("puts one pin placeholder after each passage, in a left-out element", () => {
    const { root, marked } = apply([note("u-1", "bold"), note("u-2", "Second")]);
    expect([...marked.pins.keys()]).toEqual(["u-1", "u-2"]);
    const pin = marked.pins.get("u-1") as FakeNode;
    expect(pin.hasAttribute("data-review-ui")).toBe(true);
    expect(pin.parentNode?.hasAttribute("data-review-ui")).toBe(true);
    // The mark's span comes just before the wrapper that holds the pin.
    const holder = pin.parentNode as FakeNode;
    expect(
      holder.parentNode?.childNodes[holder.parentNode.childNodes.indexOf(holder) - 1]?.getAttribute(
        "data-review-mark",
      ),
    ).toBe("u-1");
    expect(root.textContent).toContain("bold");
  });

  test("a suggestion's replacement follows its passage as text, and a comment has none", () => {
    const { root, marked } = apply([
      note("u-1", "bold", { replacement: "plain" }),
      note("u-2", "Second", { text: "why" }),
    ]);
    expect(marked.replacements.get("u-1")?.nodeValue).toBe("plain");
    expect(marked.replacements.has("u-2")).toBe(false);
    expect(show(root)).toContain("plain");
    expect(show(root)).not.toContain("why");
  });

  test("a replacement is updated in place while typing, with no new node", () => {
    const { root, marked, text } = apply([note("u-1", "bold", { replacement: "p" })]);
    const node = marked.replacements.get("u-1") as FakeNode;
    const before = show(root);
    setReplacements(marked, specsOf(text, [note("u-1", "bold", { replacement: "plain" })]));
    expect(marked.replacements.get("u-1")).toBe(node);
    expect(node.nodeValue).toBe("plain");
    expect(show(root)).toBe(before.replace(">p<", ">plain<"));
  });

  test("two annotations in one text node both wrap, whichever came first", () => {
    const root = fragment(el("p", {}, "alpha beta gamma delta"));
    const { text } = apply([note("u-2", "gamma"), note("u-1", "alpha")], root);
    const html = show(root);
    expect(html).toContain("data-review-mark=u-1>alpha</span>");
    expect(html).toContain("data-review-mark=u-2>gamma</span>");
    expect(readingTextOf(root)).toBe(text);
  });

  test("creates only elements carrying class, data-review-mark or data-review-ui, and never innerHTML or style", () => {
    const { doc } = apply([note("u-1", "bold", { replacement: "x" }), note("u-2", "Second")]);
    expect(doc.made.length).toBeGreaterThan(0);
    for (const node of doc.made) {
      for (const name of node.attributes.keys()) {
        expect(["class", "data-review-mark", "data-review-ui"]).toContain(name);
      }
    }
  });

  test("agent and user text reach the document as text nodes only", () => {
    const hostile = "<img src=x onerror=alert(1)>";
    const root = fragment(el("p", {}, `a ${hostile} b`));
    const text = readingTextOf(root);
    const doc = fakeDocument();
    const marked = applyMarks(
      root,
      specsOf(text, [note("u-1", hostile, { replacement: "</p><script>1</script>" })]),
      doc,
    );
    expect(marked.replacements.get("u-1")?.nodeValue).toBe("</p><script>1</script>");
    expect(doc.made.every((node) => node.nodeName === "SPAN")).toBe(true);
    expect(readingTextOf(root)).toBe(text);
  });

  test("skips a white-space segment that sits between blocks or list items", () => {
    const root = fragment(el("ul", {}, "\n", el("li", {}, "one"), "\n", el("li", {}, "two"), "\n"));
    const text = readingTextOf(root);
    applyMarks(root, specsOf(text, [note("u-1", "one\ntwo")]), fakeDocument());
    const html = show(root);
    expect(html.match(/data-review-mark=u-1>/g)).toHaveLength(2);
    expect(html).not.toContain("u-1>\n<");
    expect(readingTextOf(root)).toBe(text);
  });

  test("an empty plan changes nothing", () => {
    const root = documentOf();
    const before = show(root);
    const marked = applyMarks(root, [], fakeDocument());
    expect(show(root)).toBe(before);
    expect(marked.pins.size).toBe(0);
  });
});

describe("surrogate pairs", () => {
  // Every text node's boundary in the marked tree: none may fall between a pair's two units.
  const splitsPair = (root: ReadingNode): boolean => {
    const { runs } = layoutOf(root);
    return (
      runs.some((run) => {
        const data = run.node.nodeValue ?? "";
        const first = data.charCodeAt(0);
        const last = data.charCodeAt(data.length - 1);
        return (first >= 0xdc00 && first <= 0xdfff) || (last >= 0xd800 && last <= 0xdbff);
      }) &&
      runs.some((run, index) => {
        const next = runs[index + 1];
        if (next === undefined) return false;
        const last = (run.node.nodeValue ?? "").charCodeAt((run.node.nodeValue ?? "").length - 1);
        const first = (next.node.nodeValue ?? "").charCodeAt(0);
        return last >= 0xd800 && last <= 0xdbff && first >= 0xdc00 && first <= 0xdfff;
      })
    );
  };

  test("a forged exact starting or ending inside a pair marks nothing", () => {
    for (const exact of ["\uDE00y", "x\uD83D"]) {
      const root = fragment(el("p", {}, "x😀y"));
      const before = show(root);
      const marked = applyMarks(root, specsOf("x😀y", [note("u-1", exact)]), fakeDocument());
      expect(marked.pins.size).toBe(0);
      expect(show(root)).toBe(before);
    }
  });

  test("a document holding lone surrogates is marked without splitting a pair", () => {
    const text = "a\uD83Db\uDE00c😀d";
    const root = fragment(el("p", {}, text));
    applyMarks(root, specsOf(text, [note("u-1", "\uD83Db"), note("u-2", "😀")]), fakeDocument());
    expect(readingTextOf(root)).toBe(text);
    expect(splitsPair(root)).toBe(false);
  });
});

describe("keeping the pins' slots across a new plan (design decision 7)", () => {
  const text = "The bold run goes on.\nSecond paragraph here.";
  const marked = (annotations: readonly DocumentReviewAnnotation[]) => {
    const root = documentOf();
    return { root, made: applyMarks(root, specsOf(text, annotations), fakeDocument()) };
  };

  test("a slot of an annotation both plans hold is moved into the new clone, so what is drawn into it stays", () => {
    const before = marked([note("u-1", "bold")]);
    const after = marked([note("u-1", "bold"), note("u-2", "Second")]);
    const old = before.made.pins.get("u-1") as FakeNode;
    const fresh = after.made.pins.get("u-1") as FakeNode;
    const kept = reuseSlots(after.made, before.made);
    expect(kept.pins.get("u-1")).toBe(old);
    expect(kept.pins.get("u-2")).toBe(after.made.pins.get("u-2"));
    expect(after.root.contains(old)).toBe(true);
    expect(after.root.contains(fresh)).toBe(false);
    expect(before.root.contains(old)).toBe(false);
    // The slot stands where the new plan puts it: in the new clone's holder, after the passage.
    expect(old.parentNode?.hasAttribute("data-review-ui")).toBe(true);
    expect([...kept.pins.keys()]).toEqual(["u-1", "u-2"]);
    expect(kept.replacements).toBe(after.made.replacements);
  });

  test("a slot of an annotation the new plan lacks is left behind, and with no earlier plan the new one is returned as it is", () => {
    const before = marked([note("u-1", "bold"), note("u-2", "Second")]);
    const after = marked([note("u-2", "Second")]);
    const kept = reuseSlots(after.made, before.made);
    expect([...kept.pins.keys()]).toEqual(["u-2"]);
    expect(kept.pins.get("u-2")).toBe(before.made.pins.get("u-2"));
    expect(reuseSlots(after.made, undefined)).toBe(after.made);
  });

  test("never writes a style attribute or innerHTML, and the reading text is unchanged", () => {
    const before = marked([note("u-1", "bold")]);
    const after = marked([note("u-1", "bold"), note("u-2", "Second")]);
    reuseSlots(after.made, before.made);
    expect(readingTextOf(after.root)).toBe(text);
  });
});
