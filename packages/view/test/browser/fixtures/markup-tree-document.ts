// A test-only Tree with markup in a node's name, a column's label and a text field (view spec,
// "Markup in agent strings"; AD-8): the Tree shows each as text and creates no element from it.

import type { TreeProps } from "@askboard/contract";
import { MARKUP_LABEL } from "./markup-document.ts";
import { treeDocumentWith } from "./tree-documents.ts";

/** The text field's value: a script and an element, neither of which may come to life. */
export const MARKUP_NOTE = "<script>document.title='owned'</script><b>bold</b>";

export const markupTreeProps: TreeProps = {
  columns: [{ field: "note", label: MARKUP_LABEL, type: "text" }],
  nodes: [
    {
      id: "markup",
      label: MARKUP_LABEL,
      note: MARKUP_NOTE,
      children: [{ id: "plain", label: "Plain child" }],
    },
  ],
};

export const markupTreeDocument = treeDocumentWith(markupTreeProps);
