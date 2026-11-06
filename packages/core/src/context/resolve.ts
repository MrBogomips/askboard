// Resolution of a send's pointers (excerpts, design decision 4, When; proposal B4): every excerpt,
// image and reference pointer of the question revisions an `ask` or `update` creates, read through
// the `SourceFiles` port against the ask's root, at most `CONTEXT_READS_MAX` at once. When
// `CONTEXT_RESOLVE_BUDGET_MS` ends on the clock, every pointer not yet read is `timeout`, and the
// send goes on without waiting for it. Without a root or a port, every pointer is `no-root` and
// nothing is called (AD-12).

import {
  CONTEXT_READS_MAX,
  CONTEXT_RESOLVE_BUDGET_MS,
  type ContextItem,
  type LifecycleAskInput,
  type QuestionContentItem,
  type QuestionProps,
  type UnresolvedReason,
} from "@askboard/contract";
import type { Clock, Report } from "../ports.ts";
import type {
  ExcerptResolution,
  ImageResolution,
  ReferenceResolution,
  SourceFiles,
  UnresolvedPointer,
} from "./ports.ts";

/** What a pointer item resolved to. */
export type Resolution = ExcerptResolution | ImageResolution | ReferenceResolution;

/** A question revision's resolutions, by item ID. */
export type QuestionContext = ReadonlyMap<string, Resolution>;

/** A question revision whose pointers a send reads. */
export type ContextRequest = { readonly questionId: string; readonly props: QuestionProps };

export type Resolving = {
  readonly sources: SourceFiles | undefined;
  readonly root: string | undefined;
  readonly clock: Clock;
  readonly report: Report;
  /** The image bytes the ask may still carry: `ASK_IMAGES_MAX_BYTES` less what it holds. */
  readonly imageBytes: number;
};

type PointerItem = {
  readonly questionId: string;
  readonly item: ContextItem;
  readonly pointer: string;
};

const unresolved = (reason: UnresolvedReason): UnresolvedPointer => ({
  status: "unresolved",
  reason,
});

// The items whose props name a pointer: an excerpt or a reference given one, and every image. A
// widget item (widget-answers) names none.
const pointerOf = (item: QuestionContentItem): string | undefined =>
  "pointer" in item.props ? item.props.pointer : undefined;

const isContextItem = (item: QuestionContentItem): item is ContextItem =>
  item.type === "excerpt" || item.type === "reference" || item.type === "image";

/** Whether any item of the props names a pointer, so a send has something to read. */
export const hasPointers = (props: QuestionProps): boolean =>
  (props.items ?? []).some((item) => pointerOf(item) !== undefined);

/** The ask's questions, inside areas too, in board order, at their first revision. */
export const contextRequestsOf = (items: LifecycleAskInput["items"]): ContextRequest[] =>
  items.flatMap((item) =>
    item.type === "area"
      ? item.props.items.map((question) => ({ questionId: question.id, props: question.props }))
      : [{ questionId: item.id, props: item.props }],
  );

const pointerItemsOf = (requests: readonly ContextRequest[]): PointerItem[] =>
  requests.flatMap(({ questionId, props }) =>
    (props.items ?? []).flatMap((item) => {
      const pointer = isContextItem(item) ? pointerOf(item) : undefined;
      return pointer === undefined || !isContextItem(item) ? [] : [{ questionId, item, pointer }];
    }),
  );

const read = (sources: SourceFiles, root: string, { item, pointer }: PointerItem) => {
  switch (item.type) {
    case "excerpt":
      return sources.resolveExcerpt(root, pointer);
    case "image":
      return sources.resolveImage(root, pointer);
    case "reference":
      return sources.resolveReference(root, pointer);
  }
};

/**
 * Runs the reads, at most `CONTEXT_READS_MAX` at once, and settles when all have or when the budget
 * ends, whichever comes first: a read still running or not yet started is then `timeout`. A read
 * that rejects is reported and stays unresolved, `not-found`, since nothing was read from it.
 */
const settle = (
  reads: readonly (() => Promise<Resolution>)[],
  { clock, report }: Pick<Resolving, "clock" | "report">,
): Promise<Resolution[]> =>
  new Promise((resolve) => {
    const results: (Resolution | undefined)[] = reads.map(() => undefined);
    let started = 0;
    let settled = 0;
    let over = false;
    const finish = () => {
      over = true;
      cancel();
      resolve(results.map((result) => result ?? unresolved("timeout")));
    };
    const cancel = clock.after(CONTEXT_RESOLVE_BUDGET_MS, finish);
    const start = () => {
      if (over || started >= reads.length) return;
      const index = started;
      started += 1;
      Promise.resolve()
        .then(reads[index])
        .catch((error: unknown) => {
          report(error);
          return unresolved("not-found");
        })
        .then((result) => {
          if (over) return;
          results[index] = result;
          settled += 1;
          if (settled === reads.length) finish();
          else start();
        });
    };
    for (let slot = 0; slot < CONTEXT_READS_MAX; slot += 1) start();
  });

/** The bytes a base64 string decodes to. */
export const base64Bytes = (text: string): number => {
  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;
  return (text.length / 4) * 3 - padding;
};

/**
 * The per-ask image cap (proposal B4), in item order: an image whose bytes would take the ask past
 * what it may still carry is `too-large`, and the images after it may still fit.
 */
const capImages = (items: readonly PointerItem[], results: Resolution[], imageBytes: number) => {
  let left = imageBytes;
  return results.map((result, index) => {
    if (items[index]?.item.type !== "image" || !("bytes" in result)) return result;
    const size = base64Bytes(result.bytes);
    if (size > left) return unresolved("too-large");
    left -= size;
    return result;
  });
};

/**
 * Resolves every pointer of the requests, and gives each question's resolutions by item ID; a
 * question with no pointer gets none. Never rejects: a pointer that cannot be read is unresolved.
 */
export const resolveContext = async (
  requests: readonly ContextRequest[],
  resolving: Resolving,
): Promise<Map<string, QuestionContext>> => {
  const items = pointerItemsOf(requests);
  const { sources, root } = resolving;
  const results =
    items.length === 0
      ? []
      : sources === undefined || root === undefined
        ? items.map(() => unresolved("no-root"))
        : capImages(
            items,
            await settle(
              items.map((item) => () => read(sources, root, item)),
              resolving,
            ),
            resolving.imageBytes,
          );
  const context = new Map<string, Map<string, Resolution>>();
  for (const [index, { questionId, item }] of items.entries()) {
    const resolutions = context.get(questionId) ?? new Map<string, Resolution>();
    resolutions.set(item.id, results[index] as Resolution);
    context.set(questionId, resolutions);
  }
  return context;
};
