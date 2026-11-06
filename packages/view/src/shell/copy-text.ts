// Puts text on the clipboard on the user's click, from the view (review F-06: a saved Snapshot's
// "Copy path"). The view is a sandboxed frame that may not be granted the asynchronous Clipboard
// API, so a refused write falls back to a selected, read-only text area copied the old way; a
// browser that copies neither throws.

export const copyText = async (document: Document, text: string): Promise<void> => {
  const clipboard = document.defaultView?.navigator.clipboard;
  if (clipboard !== undefined) {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // Falls through to the text area.
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.className = "fixed -left-[9999px] top-0";
  document.body.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("the browser did not copy the text");
};
