// Kept diagram renders in a Snapshot (snapshot design decision 4, Kept renders; open question B3):
// which components a Snapshot's renders cover, so that `selectChunks` takes the kept-render chunk a
// component chunk names in place of that chunk. Selection reads `renders` only for this; showing a
// kept render is the Diagram epic's. Plain ECMAScript only.

import type { SnapshotRender } from "@askboard/contract";
import { renderedOf } from "../catalog/components.ts";
import { questionsOf, type ViewDocument } from "../view-document.ts";

/**
 * The components every item of which has a kept render: a render naming the item's ID and the
 * current revision of the question that holds it, the revision the Snapshot shows.
 */
export const keptComponents = (
  document: ViewDocument,
  renders: readonly SnapshotRender[],
): ReadonlySet<string> => {
  const covered = new Map<string, boolean>();
  for (const question of questionsOf(document)) {
    for (const { item, component } of renderedOf(question)) {
      const kept = renders.some(({ itemId, rev }) => itemId === item.id && rev === question.rev);
      covered.set(component, (covered.get(component) ?? true) && kept);
    }
  }
  return new Set([...covered].flatMap(([component, all]) => (all ? [component] : [])));
};
