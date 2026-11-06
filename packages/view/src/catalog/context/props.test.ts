import { describe, expect, test } from "bun:test";
import { IMAGE_MEDIA_TYPES } from "@askboard/contract";
import { contextBoardDocument, ONE_PIXEL_PNG } from "@askboard/contract/fixtures";
import {
  captionOf,
  excerptOf,
  imageCaptionOf,
  imageOf,
  linesOf,
  opensInPanel,
  referenceOf,
  SHOWN_IMAGE_TYPES,
} from "./props.ts";

const propsOf = (id: string): unknown => {
  for (const question of contextBoardDocument.items) {
    const item = question.props.items?.find((each) => each.id === id);
    if (item !== undefined) return item.props;
  }
  throw new Error(`the fixture holds no item ${id}`);
};

describe("excerptOf and captionOf (excerpts, design decision 6)", () => {
  test("a resolved excerpt: its text by lines from its first line, Markdown wrapping", () => {
    const excerpt = excerptOf(propsOf("retry-adr"));
    expect(excerpt).toEqual({
      kind: "resolved",
      pointer: "docs/adr/0012-payment-retries.md#Decision",
      text: "## Decision\n\nWe retry a failed payment three times, with exponential backoff.",
      wraps: true,
      start: 7,
      end: 9,
    });
    expect(captionOf(excerpt)).toEqual({
      title: "Decision",
      source: "docs/adr/0012-payment-retries.md#Decision",
      range: "lines 7–9",
    });
  });

  test("code keeps its lines, one line is named as one, and a title wins over the anchor", () => {
    const excerpt = excerptOf({
      pointer: "src/a.ts#L4-L4",
      title: "The guard",
      status: "resolved",
      text: "if (x) return;",
      mediaType: "text/plain",
      lines: { start: 4, end: 4 },
    });
    expect(excerpt).toMatchObject({ kind: "resolved", wraps: false, start: 4 });
    expect(captionOf(excerpt)).toEqual({
      title: "The guard",
      source: "src/a.ts#L4-L4",
      range: "line 4",
    });
  });

  test("a line-range anchor or none leaves the file name as the title", () => {
    const of = (pointer: string) =>
      captionOf(
        excerptOf({
          pointer,
          status: "resolved",
          text: "x",
          mediaType: "text/plain",
          lines: { start: 1, end: 1 },
        }),
      ).title;
    expect(of("src/deep/retry.ts#L1-L1")).toBe("retry.ts");
    expect(of("src/deep/retry.ts#L1")).toBe("L1");
    expect(of("README.md")).toBe("README.md");
  });

  test("an unresolved excerpt keeps its pointer and has no source line", () => {
    const excerpt = excerptOf(propsOf("missing-doc"));
    expect(excerpt).toEqual({ kind: "unresolved", pointer: "docs/missing.md#Intro" });
    expect(captionOf(excerpt)).toEqual({ title: "Intro" });
  });

  test("an excerpt the agent wrote is numbered from 1, keeps its lines and shows its title alone", () => {
    const excerpt = excerptOf(propsOf("settings-note"));
    expect(excerpt).toEqual({
      kind: "written",
      title: "Retry settings",
      text: "retries: 3\nbackoff: exponential",
      wraps: false,
      start: 1,
    });
    expect(captionOf(excerpt)).toEqual({ title: "Retry settings" });
    expect(captionOf(excerptOf({ text: "a" }))).toEqual({});
  });

  test("props that are no board document's excerpt throw", () => {
    for (const props of [
      undefined,
      null,
      "text",
      {},
      { pointer: "a.md", status: "resolved", text: "x", mediaType: "text/plain" },
      { pointer: "a.md", status: "resolved", text: "x", mediaType: "text/plain", lines: {} },
      { pointer: "a.md", status: "resolved", text: 1, mediaType: "text/plain", lines: {} },
      { pointer: "a.md", status: "other" },
      { pointer: 3, status: "unresolved", reason: "not-found" },
      { text: 3 },
    ]) {
      expect(() => excerptOf(props)).toThrow("not an excerpt");
    }
  });
});

describe("linesOf", () => {
  test("splits on LF and numbers each line from the first, whatever the range's end says", () => {
    expect(linesOf("a\n\nc", 40)).toEqual([
      { number: 40, text: "a" },
      { number: 41, text: "" },
      { number: 42, text: "c" },
    ]);
    expect(linesOf("", 3)).toEqual([{ number: 3, text: "" }]);
  });
});

describe("referenceOf", () => {
  test("only an http or https URL is a link; any other scheme is text", () => {
    const web = (url: string) => referenceOf({ url, kind: "web" });
    expect(web("http://example.com/a")).toHaveProperty("href", "http://example.com/a");
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "ftp://example.com",
      "not a url",
    ]) {
      expect(web(url)).not.toHaveProperty("href");
    }
    expect(referenceOf({ pointer: "src/a.ts", kind: "file" })).not.toHaveProperty("href");
  });

  test("a FILE reference opens in the reading panel, its title or its pointer shown", () => {
    expect(referenceOf(propsOf("retry-src"))).toEqual({
      label: "FILE",
      shown: "src/retry.ts#L1-L5",
      target: "src/retry.ts#L1-L5",
      external: false,
    });
    expect(referenceOf(propsOf("readme"))).toMatchObject({ shown: "Read me", target: "README.md" });
    expect(referenceOf(propsOf("old-src"))).toMatchObject({ label: "FILE", external: false });
  });

  test("a GITHUB or WEB reference opens in the browser", () => {
    expect(referenceOf(propsOf("pr"))).toEqual({
      label: "GITHUB",
      href: "https://github.com/acme/pay/pull/12",
      shown: "PR 12",
      target: "https://github.com/acme/pay/pull/12",
      external: true,
    });
    expect(referenceOf(propsOf("runbook"))).toEqual({
      label: "WEB",
      href: "https://acme.atlassian.net/wiki/runbook",
      shown: "https://acme.atlassian.net/wiki/runbook",
      target: "https://acme.atlassian.net/wiki/runbook",
      external: true,
    });
  });

  test("props that are no board document's reference throw", () => {
    for (const props of [
      {},
      { pointer: "a.md", kind: "web" },
      { url: "https://a.example", kind: "file" },
      { url: "https://a.example", kind: "ftp" },
      { pointer: "a.md", kind: "file", title: 3 },
    ]) {
      expect(() => referenceOf(props)).toThrow("not a reference");
    }
  });
});

describe("imageOf", () => {
  test("a resolved image keeps its bytes and media type, an unresolved one its pointer", () => {
    expect(imageOf(propsOf("shot"))).toEqual({
      kind: "resolved",
      pointer: ".askboard/media/shot.png",
      alt: "The retry log",
      mediaType: "image/png",
      bytes: ONE_PIXEL_PNG,
    });
    expect(imageOf(propsOf("diagram"))).toEqual({
      kind: "unresolved",
      pointer: ".askboard/media/diagram.svg",
      alt: "The rollout plan",
    });
  });

  test("the media types it shows are the contract's, and no other is shown", () => {
    expect([...SHOWN_IMAGE_TYPES]).toEqual([...IMAGE_MEDIA_TYPES]);
    const shown = { pointer: "a.png", alt: "A", status: "resolved", bytes: ONE_PIXEL_PNG };
    expect(() => imageOf({ ...shown, mediaType: "image/svg+xml" })).toThrow("not an image");
    for (const props of [{}, { ...shown, mediaType: "image/png", alt: 1 }, { ...shown }]) {
      expect(() => imageOf(props)).toThrow("not an image");
    }
  });
});

describe("an image's caption line (review F-24)", () => {
  test("is its alt text, else its path", () => {
    expect(imageCaptionOf(imageOf(propsOf("shot")))).toBe("The retry log");
    const bare = { pointer: "shots/a.png", alt: "  ", status: "unresolved" };
    expect(imageCaptionOf(imageOf(bare))).toBe("shots/a.png");
  });
});

describe("opensInPanel (review F-25)", () => {
  test("a resolved excerpt in a hosted view only: not a written one, not an unresolved pointer", () => {
    const resolved = excerptOf(propsOf("retry-adr"));
    expect(opensInPanel(resolved, true)).toBe(true);
    expect(opensInPanel(resolved, false)).toBe(false);
    const unresolved = excerptOf(propsOf("missing-doc"));
    expect(opensInPanel(unresolved, true)).toBe(false);
    expect(opensInPanel({ kind: "written", text: "x", wraps: false, start: 1 }, true)).toBe(false);
  });
});
