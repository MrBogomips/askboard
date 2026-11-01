import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { linkSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ANCHOR_FILE_MAX_BYTES,
  EXCERPT_MAX_LINES,
  IMAGE_MAX_BYTES,
  SOURCE_VIEW_MAX_BYTES,
  SOURCE_VIEW_MAX_LINES,
  type UnresolvedReason,
} from "@askboard/contract";
import type { SourceFiles } from "@askboard/core";
import { createSourceFiles } from "../../src/excerpts/index.ts";
import { makeSandbox, type Sandbox, SENTINEL_TEXT, type SpyFs, spyFs } from "./helpers.ts";

// The six operations of the SourceFiles adapter (excerpts, task 2.5; design decision 3), each
// over steps 1 to 6, on real temporary folders: the board-host spec's attacks again through every
// operation, the reasons each gives, and the source view's and the editor's answers. After every
// test no handle is open, the sentinel outside the root is unread, and no result holds it.

const ADR = [
  "# ADR 0012: Payment retries", // 1
  "",
  "## Status",
  "",
  "Accepted.", // 5
  "",
  "## Decision",
  "",
  "We retry a failed payment three times, with exponential backoff.",
  "", // 10
  "## Consequences",
  "",
  "Duplicate charges need an idempotency key.",
].join("\n");

const DECISION = [
  "## Decision",
  "",
  "We retry a failed payment three times, with exponential backoff.",
];

const RETRY = [
  "export const retry = async () => {",
  "  for (let i = 0; i < 3; i++) {",
  "  }",
  "};",
  "",
];

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2]);

let box: Sandbox;
let spy: SpyFs;
let files: SourceFiles;
const results: unknown[] = [];

const remember = <T>(result: T): T => {
  results.push(result);
  return result;
};

beforeEach(() => {
  box = makeSandbox();
  spy = spyFs();
  files = createSourceFiles({ projectRoot: box.root, fs: spy.fs });
  box.write("docs/adr/0012-payment-retries.md", `${ADR}\n`);
  box.write("src/retry.ts", RETRY.join("\n"));
  box.write(".askboard/media/shot.png", PNG);
});

afterEach(() => {
  const untouched = box.sentinelUntouched();
  const openHandles = spy.openHandles();
  const leaked = JSON.stringify(results.splice(0)).includes(SENTINEL_TEXT);
  box.remove();
  expect({ untouched, openHandles, leaked }).toEqual({
    untouched: true,
    openHandles: 0,
    leaked: false,
  });
});

const every = (root: string, pointer: string) =>
  Promise.all([
    files.resolveExcerpt(root, pointer),
    files.resolveImage(root, pointer),
    files.resolveReference(root, pointer),
    files.sourceState(root, pointer, "x"),
    files.readSource(root, pointer),
    files.editorTarget(root, pointer),
  ]).then(remember);

describe("before any file system call", () => {
  test("with no project root, every operation answers no-root and calls nothing", async () => {
    const rootless = createSourceFiles({ projectRoot: undefined, fs: spy.fs });
    for (const projectless of [rootless, createSourceFiles({ projectRoot: "", fs: spy.fs })]) {
      // Even with the ask's root given, as an owned ask's origin gives one (XC-A1).
      const root = box.root;
      const pointer = "docs/adr/0012-payment-retries.md#Decision";
      expect(
        await Promise.all([
          projectless.resolveExcerpt(root, pointer),
          projectless.resolveImage(root, ".askboard/media/shot.png"),
          projectless.resolveReference(root, pointer),
          projectless.sourceState(root, pointer),
          projectless.readSource(root, pointer),
          projectless.editorTarget(root, pointer),
        ]),
      ).toEqual([
        { status: "unresolved", reason: "no-root" },
        { status: "unresolved", reason: "no-root" },
        { status: "unresolved", reason: "no-root" },
        { status: "missing" },
        { status: "missing" },
        undefined,
      ]);
    }
    expect(spy.calls).toEqual([]);
  });

  test("an invalid pointer, and a pointer whose anchor does not fit its item, call nothing", async () => {
    for (const pointer of ["../secret.md#A", "/etc/passwd#L1-L2", "docs\\x.md#A", "a.md#"]) {
      const [excerpt, image, reference, state, source, target] = await every(box.root, pointer);
      expect([excerpt, image, reference]).toEqual([
        { status: "unresolved", reason: "invalid-pointer" },
        { status: "unresolved", reason: "invalid-pointer" },
        { status: "unresolved", reason: "invalid-pointer" },
      ]);
      expect([state, source, target]).toEqual([
        { status: "missing" },
        { status: "missing" },
        undefined,
      ]);
    }
    // An excerpt needs an anchor, and an image has none (proposal A6).
    expect(await files.resolveExcerpt(box.root, "docs/adr/0012-payment-retries.md")).toEqual({
      status: "unresolved",
      reason: "invalid-pointer",
    });
    expect(await files.resolveImage(box.root, ".askboard/media/shot.png#L1-L1")).toEqual({
      status: "unresolved",
      reason: "invalid-pointer",
    });
    expect(spy.calls).toEqual([]);
  });
});

describe("the board-host spec's attacks, through every operation", () => {
  const ATTACKS: readonly (readonly [string, (box: Sandbox) => void, UnresolvedReason])[] = [
    ["a file symlink out", (b) => b.link("docs/link.md", b.sentinel), "outside-root"],
    ["a folder symlink out", (b) => b.link("vendor", b.outside), "outside-root"],
    [
      "a chain whose last link leaves",
      (b) => {
        b.link("docs/a.md", "b.md");
        b.link("docs/b.md", "../../proj-old/x.md");
      },
      "outside-root",
    ],
    ["an absolute link to /etc/hosts", (b) => b.link("hosts.md", "/etc/hosts"), "outside-root"],
    ["/dev/null through an in-root link", (b) => b.link("null.md", "/dev/null"), "outside-root"],
    [
      "a FIFO",
      (b) => expect(Bun.spawnSync(["mkfifo", join(b.root, "pipe.md")]).exitCode).toBe(0),
      "not-a-file",
    ],
    ["a directory", (b) => b.write("dir.md/x", "x"), "not-a-file"],
  ];
  const POINTERS = [
    "docs/link.md#Secret",
    "vendor/x.md#Secret",
    "docs/a.md#Secret",
    "hosts.md#L1-L1",
    "null.md#L1-L1",
    "pipe.md#L1-L1",
    "dir.md#L1-L1",
  ];

  test.each(ATTACKS.map(([label, make, reason], index) => [label, make, reason, index] as const))(
    "%s: refused by each operation, nothing read",
    async (_, make, reason, index) => {
      make(box);
      const pointer = POINTERS[index] ?? "";
      const imagePointer = pointer.replace(/#.*$/, "");
      const [excerpt, , reference, state, source, target] = await every(box.root, pointer);
      const image = remember(await files.resolveImage(box.root, imagePointer));
      const unresolved = { status: "unresolved" as const, reason };
      expect([excerpt, image, reference]).toEqual([unresolved, unresolved, unresolved]);
      const status = reason === "outside-root" ? "outside-root" : "not-text";
      expect([state, source, target]).toEqual([{ status }, { status }, undefined]);
      expect(spy.calls.map((entry) => entry.call)).not.toContain("read");
    },
  );

  test("a sibling sharing the root's prefix is outside for every operation", async () => {
    box.link("docs/x.md", join(box.base, "proj-old/x.md"));
    const [excerpt, , reference, state, source, target] = await every(box.root, "docs/x.md#Secret");
    expect([excerpt, reference, state, source, target]).toEqual([
      { status: "unresolved", reason: "outside-root" },
      { status: "unresolved", reason: "outside-root" },
      { status: "outside-root" },
      { status: "outside-root" },
      undefined,
    ]);
  });

  test("a missing file is not-found, and missing in the reading panel", async () => {
    const [excerpt, image, reference, state, source, target] = await every(
      box.root,
      "docs/missing.md#Intro",
    );
    expect([excerpt, image, reference]).toEqual([
      { status: "unresolved", reason: "not-found" },
      { status: "unresolved", reason: "invalid-pointer" },
      { status: "unresolved", reason: "not-found" },
    ]);
    expect([state, source, target]).toEqual([
      { status: "missing" },
      { status: "missing" },
      undefined,
    ]);
  });

  test("a hard link inside the root to a file outside it is read: the accepted risk, pinned", async () => {
    // design.md, Risks: paths cannot tell a hard link; making one needs write access to the
    // file's own folder tree on the same volume. Not the sentinel, whose access time must hold.
    const elsewhere = mkdtempSync(join(tmpdir(), "askboard-excerpts-hard-"));
    try {
      writeFileSync(join(elsewhere, "linked.md"), "# Linked\nfrom outside\n");
      linkSync(join(elsewhere, "linked.md"), join(box.root, "linked.md"));
      expect(remember(await files.resolveExcerpt(box.root, "linked.md#Linked"))).toEqual({
        status: "resolved",
        text: "# Linked\nfrom outside",
        mediaType: "text/markdown",
        lines: { start: 1, end: 2 },
      });
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });
});

describe("resolveExcerpt", () => {
  test("the approved UJ-1 pointer gives the Decision section, with its lines", async () => {
    expect(
      remember(await files.resolveExcerpt(box.root, "docs/adr/0012-payment-retries.md#Decision")),
    ).toEqual({
      status: "resolved",
      text: DECISION.join("\n"),
      mediaType: "text/markdown",
      lines: { start: 7, end: 9 },
    });
  });

  test("a line range gives those lines as plain text, with breaks made LF and the BOM dropped", async () => {
    box.write("src/crlf.ts", Uint8Array.from([0xef, 0xbb, 0xbf, ...Buffer.from("a\r\nb\rc\n")]));
    expect(await files.resolveExcerpt(box.root, "src/retry.ts#L1-L2")).toEqual({
      status: "resolved",
      text: RETRY.slice(0, 2).join("\n"),
      mediaType: "text/plain",
      lines: { start: 1, end: 2 },
    });
    expect(await files.resolveExcerpt(box.root, "src/crlf.ts#L1-L3")).toMatchObject({
      text: "a\nb\nc",
    });
  });

  test("a link that stays inside reads the file it leads to", async () => {
    box.link("latest.md", "docs/adr/0012-payment-retries.md");
    expect(await files.resolveExcerpt(box.root, "latest.md#Decision")).toMatchObject({
      status: "resolved",
      lines: { start: 7, end: 9 },
    });
  });

  test.each([
    ["a heading the file lacks", "docs/adr/0012-payment-retries.md#Setup", "anchor-not-found"],
    ["a range past the end", "src/retry.ts#L3-L60", "anchor-not-found"],
    ["a heading anchor in a .ts file", "src/retry.ts#retry", "anchor-not-found"],
    ["an image read as text", ".askboard/media/shot.png#L1-L1", "not-text"],
  ] as const)("%s is %s", async (_, pointer, reason) => {
    expect(await files.resolveExcerpt(box.root, pointer)).toEqual({ status: "unresolved", reason });
  });

  test("a file over the anchor limit, and an excerpt over its own, are too-large", async () => {
    box.write("big.md", `# Big\n${"x".repeat(ANCHOR_FILE_MAX_BYTES)}\n`);
    box.write("long.md", `# Long\n${"line\n".repeat(EXCERPT_MAX_LINES)}`);
    for (const pointer of ["big.md#Big", "long.md#Long", `long.md#L1-L${EXCERPT_MAX_LINES + 1}`]) {
      expect(await files.resolveExcerpt(box.root, pointer)).toEqual({
        status: "unresolved",
        reason: "too-large",
      });
    }
    expect(spy.bytesRead()).toBeLessThanOrEqual(2 * (EXCERPT_MAX_LINES * 5 + 7));
  });
});

describe("resolveImage", () => {
  test("a PNG gives its media type and its bytes in base64", async () => {
    expect(await files.resolveImage(box.root, ".askboard/media/shot.png")).toEqual({
      status: "resolved",
      mediaType: "image/png",
      bytes: Buffer.from(PNG).toString("base64"),
    });
  });

  test("HTML named as a PNG and an SVG are not-image", async () => {
    box.write(".askboard/media/page.png", "<!doctype html><script>alert(1)</script>");
    box.write(".askboard/media/icon.svg", '<svg xmlns="http://www.w3.org/2000/svg"/>');
    for (const pointer of [".askboard/media/page.png", ".askboard/media/icon.svg"]) {
      expect(await files.resolveImage(box.root, pointer)).toEqual({
        status: "unresolved",
        reason: "not-image",
      });
    }
  });

  test("an image over the image limit is too-large, read no further than the limit", async () => {
    const big = new Uint8Array(IMAGE_MAX_BYTES + 1);
    big.set(PNG);
    box.write(".askboard/media/big.png", big);
    expect(await files.resolveImage(box.root, ".askboard/media/big.png")).toEqual({
      status: "unresolved",
      reason: "too-large",
    });
    expect(spy.bytesRead()).toBe(0);
  });
});

describe("resolveReference", () => {
  test("without an anchor, a regular file inside resolves with no lines, opened and closed", async () => {
    expect(await files.resolveReference(box.root, "src/retry.ts")).toEqual({ status: "resolved" });
    expect(await files.resolveReference(box.root, ".askboard/media/shot.png")).toEqual({
      status: "resolved",
    });
    expect(spy.calls.map((entry) => entry.call)).toContain("close");
    expect(spy.calls.map((entry) => entry.call)).not.toContain("read");
  });

  test("with an anchor, it gives the anchor's lines and no text", async () => {
    expect(await files.resolveReference(box.root, "src/retry.ts#L1-L5")).toEqual({
      status: "unresolved",
      reason: "anchor-not-found",
    });
    expect(await files.resolveReference(box.root, "src/retry.ts#L1-L4")).toEqual({
      status: "resolved",
      lines: { start: 1, end: 4 },
    });
    expect(
      await files.resolveReference(box.root, "docs/adr/0012-payment-retries.md#Consequences"),
    ).toEqual({ status: "resolved", lines: { start: 11, end: 13 } });
  });

  test("a section longer than an excerpt may be still resolves for a reference", async () => {
    box.write("long.md", `# Long\n${"line\n".repeat(EXCERPT_MAX_LINES)}`);
    expect(await files.resolveReference(box.root, "long.md#Long")).toEqual({
      status: "resolved",
      lines: { start: 1, end: EXCERPT_MAX_LINES + 1 },
    });
  });
});

describe("sourceState and readSource, for the reading panel and the source view", () => {
  const ADR_POINTER = "docs/adr/0012-payment-retries.md#Decision";
  const SENT = DECISION.join("\n");

  test("an unchanged excerpt is available at its anchor's line, not changed", async () => {
    expect(await files.sourceState(box.root, ADR_POINTER, SENT)).toEqual({
      status: "available",
      line: 7,
      changed: false,
    });
    expect(await files.readSource(box.root, ADR_POINTER)).toEqual({
      status: "available",
      text: ADR,
      hit: { start: 7, end: 9 },
    });
  });

  test("an excerpt whose lines changed since the ask is changed, at the anchor's current line", async () => {
    box.write("docs/adr/0012-payment-retries.md", ADR.replace("three times", "five times"));
    expect(await files.sourceState(box.root, ADR_POINTER, SENT)).toEqual({
      status: "available",
      line: 7,
      changed: true,
    });
    box.write("docs/adr/0012-payment-retries.md", `# Moved\n\n${ADR}`);
    expect(await files.sourceState(box.root, ADR_POINTER, SENT)).toEqual({
      status: "available",
      line: 9,
      changed: false,
    });
  });

  test("an excerpt whose anchor is gone is changed, with no line", async () => {
    box.write("docs/adr/0012-payment-retries.md", ADR.replace("## Decision", "## Choice"));
    expect(await files.sourceState(box.root, ADR_POINTER, SENT)).toEqual({
      status: "available",
      changed: true,
    });
    expect(await files.readSource(box.root, ADR_POINTER)).toEqual({
      status: "available",
      text: ADR.replace("## Decision", "## Choice"),
    });
  });

  test("a reference has no changed, and without an anchor no line", async () => {
    expect(await files.sourceState(box.root, "src/retry.ts")).toEqual({ status: "available" });
    expect(await files.sourceState(box.root, "src/retry.ts#L2-L3")).toEqual({
      status: "available",
      line: 2,
    });
  });

  test("a file that is not text is not-text, and a missing one missing", async () => {
    expect(await files.sourceState(box.root, ".askboard/media/shot.png")).toEqual({
      status: "not-text",
    });
    expect(await files.readSource(box.root, "docs/gone.md")).toEqual({ status: "missing" });
  });

  test("a file over the source view's bytes or lines is too-large, with its size", async () => {
    box.write("big.txt", "x".repeat(SOURCE_VIEW_MAX_BYTES + 10));
    const many = "l\n".repeat(SOURCE_VIEW_MAX_LINES + 1);
    box.write("many.txt", many);
    expect(await files.sourceState(box.root, "big.txt")).toEqual({
      status: "too-large",
      size: SOURCE_VIEW_MAX_BYTES + 10,
    });
    expect(await files.readSource(box.root, "many.txt#L1-L2")).toEqual({
      status: "too-large",
      size: many.length,
    });
    expect(spy.bytesRead()).toBe(many.length);
  });
});

describe("editorTarget", () => {
  test("gives the real path and the anchor's line, confined again", async () => {
    expect(await files.editorTarget(box.root, "docs/adr/0012-payment-retries.md#Decision")).toEqual(
      {
        file: join(box.realRoot, "docs/adr/0012-payment-retries.md"),
        line: 7,
      },
    );
    expect(await files.editorTarget(box.root, "src/retry.ts#L3-L4")).toEqual({
      file: join(box.realRoot, "src/retry.ts"),
      line: 3,
    });
    expect(await files.editorTarget(box.root, "src/retry.ts")).toEqual({
      file: join(box.realRoot, "src/retry.ts"),
    });
  });

  test("a file whose anchor no longer resolves, or too large to search, still opens, with no line", async () => {
    box.write("big.md", `# Big\n${"x".repeat(ANCHOR_FILE_MAX_BYTES)}\n`);
    expect(await files.editorTarget(box.root, "big.md#Big")).toEqual({
      file: join(box.realRoot, "big.md"),
    });
    expect(await files.editorTarget(box.root, "src/retry.ts#L9-L10")).toEqual({
      file: join(box.realRoot, "src/retry.ts"),
    });
  });

  test("a file swapped for a symlink out of the root after the send gives no target", async () => {
    const pointer = "docs/adr/0012-payment-retries.md#Decision";
    expect(await files.resolveExcerpt(box.root, pointer)).toMatchObject({ status: "resolved" });
    const path = join(box.root, "docs/adr/0012-payment-retries.md");
    renameSync(path, join(box.root, "kept.md"));
    symlinkSync(box.sentinel, path);
    expect(await files.editorTarget(box.root, pointer)).toBeUndefined();
  });

  test("a name that looks like a shell command comes back as one real path, unchanged", async () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a shell expansion is the point
    const name = "docs/$(touch pwned);x `id` '\"${HOME} -rf.md";
    box.write(name, "# T\n");
    expect(await files.editorTarget(box.root, `${name}#T`)).toEqual({
      file: join(box.realRoot, name),
      line: 1,
    });
  });
});
