// The `SourceFiles` port (excerpts, design decisions 3 and 4; proposal B1): a pointer's file read
// read-only and only inside the ask's root. `excerpts` implements it and the session process wires
// it; ask-core resolves through it when an ask or an update is sent, and answers board-host's
// requests for a source's state and the editor target with the ask's root it alone holds (AD-5,
// AD-12). Every call takes that root, and the pointer as the agent wrote it. Runtime-neutral (AD-1).

import type {
  ImageMediaType,
  LineRange,
  SourceStatus,
  TextMediaType,
  UnresolvedReason,
} from "@askboard/contract";

/** A pointer that did not resolve, and why. */
export type UnresolvedPointer = {
  readonly status: "unresolved";
  readonly reason: UnresolvedReason;
};

/** An excerpt's text, its lines joined by LF, and the lines it came from. */
export type ExcerptResolution =
  | {
      readonly status: "resolved";
      readonly text: string;
      readonly mediaType: TextMediaType;
      readonly lines: LineRange;
    }
  | UnresolvedPointer;

/** An image's type, recognised by its first bytes, and its bytes in base64. */
export type ImageResolution =
  | { readonly status: "resolved"; readonly mediaType: ImageMediaType; readonly bytes: string }
  | UnresolvedPointer;

/** A reference's file exists inside the root, with its anchor's lines when it has one. */
export type ReferenceResolution =
  | { readonly status: "resolved"; readonly lines?: LineRange }
  | UnresolvedPointer;

/** A source that cannot be shown, and, when it is too large, its size in bytes. */
export type SourceUnavailable =
  | { readonly status: Exclude<SourceStatus, "available" | "too-large"> }
  | { readonly status: "too-large"; readonly size: number };

/**
 * A source's state now: for the reading panel, its anchor's current first line and, for an
 * excerpt, whether the excerpted range now differs from the text the board shows.
 */
export type SourceState =
  | { readonly status: "available"; readonly line?: number; readonly changed?: boolean }
  | SourceUnavailable;

/** A source's text for the source view, its lines joined by LF, and the anchor's lines. */
export type SourceText =
  | { readonly status: "available"; readonly text: string; readonly hit?: LineRange }
  | SourceUnavailable;

/** What "Open in editor" opens: a real path inside the root, and the anchor's line when found. */
export type EditorTarget = { readonly file: string; readonly line?: number };

export type SourceFiles = {
  resolveExcerpt(root: string, pointer: string): Promise<ExcerptResolution>;
  resolveImage(root: string, pointer: string): Promise<ImageResolution>;
  resolveReference(root: string, pointer: string): Promise<ReferenceResolution>;
  /** `sentText` is an excerpt's text as the board shows it; without it, no `changed`. */
  sourceState(root: string, pointer: string, sentText?: string): Promise<SourceState>;
  readSource(root: string, pointer: string): Promise<SourceText>;
  /** Undefined when the pointer no longer resolves to a regular file inside the root. */
  editorTarget(root: string, pointer: string): Promise<EditorTarget | undefined>;
};
