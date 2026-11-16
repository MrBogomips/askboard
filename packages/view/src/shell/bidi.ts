// Isolating agent and user text that is joined into a string a screen reader or a tooltip shows
// (EXPERIENCE.md, Agent text; AD-8): a bidirectional override or isolate inside the text must not
// reorder what stands around it. Elements use `<bdi className="inline-block">`; a string, which
// cannot hold an element, wraps the text in a first-strong isolate (U+2068 ... U+2069) after
// removing every embedding, override and isolate control, so that a stray one cannot close it.

const CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;

/** The text with no bidirectional control, inside one first-strong isolate. */
export const isolate = (text: string): string => `\u2068${text.replace(CONTROLS, "")}\u2069`;
