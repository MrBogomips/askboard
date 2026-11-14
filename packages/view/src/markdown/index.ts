// The shared Markdown renderer (document-review, design decision 6; spine AD-1 and AD-9): the
// module the Text atom and the Document review render Markdown through, in the `markdown` library
// chunk. It holds markdown-it, DOMPurify, the link handling and the element classes, so that a
// board or a Snapshot loads them once, and only when one of its items renders Markdown. The names
// below are the chunk's exact list (`LIBRARY_CHUNKS.markdown`): another name fails the build.

export { MARKDOWN, PLAIN } from "./classes.ts";
export { markExternal, mountMarkdown } from "./links.ts";
export { renderMarkdown } from "./markdown.ts";
