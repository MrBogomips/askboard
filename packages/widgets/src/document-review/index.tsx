// The Document review's chunk (design decisions 7 and 15): it registers `document-review` through the
// `CatalogRenderer` port, the one part of `view` a widget imports (AD-1, AD-9), and reads the
// Markdown renderer from the library chunk and `react-dom`'s `createPortal` from the react chunk,
// bundling neither. The view hands a Document review's props over as data, unchecked, so the
// component checks them as an agent's with the contract's plain checks and throws on a problem: the
// item's error boundary then fails it and its question never counts as visible (AD-10). An untouched
// review reports no result; the annotations a user made are reported whole, in the order made.

import { documentReviewResultProblems, documentReviewResultShape } from "@askboard/contract";
import { register } from "@askboard/view/catalog";
import { detachedCheck } from "./detached-check.ts";
import { DocumentReview } from "./item.tsx";

/** The catalog name, which is the Document review item's type. */
const DOCUMENT_REVIEW = "document-review";

// The facts the shell needs of the Document review (widget-registry, design decision 8; design
// decisions 7 and 15): its name in the notice, whether a result fits its props by the contract's
// shape and props checks (`fits`, the two `widgetResultFits` runs), and that its quotes point into
// the document of the revision they were made on (`revisionBound`), so the item is read-only on a
// revision the board cannot show. It edits nothing, so it registers no `shape`, and it asks for no
// reason or confirmation. Its field check, that a held annotation the document no longer places
// blocks the answer (`detached`), is `detachedCheck`, which shares the component's reading and places.
register(DOCUMENT_REVIEW, DocumentReview, {
  name: "change.widgetDocumentReview",
  fits: (result, props) =>
    documentReviewResultShape(result) && documentReviewResultProblems(result, props).length === 0,
  revisionBound: true,
  check: detachedCheck,
});
