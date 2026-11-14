// The Document review's widget (view-and-widgets spec: A Document review's document, Commenting on a
// passage, Suggesting an edit, Passages the board does not anchor, Editing and deleting annotations,
// A Document review's result, Detached annotations; design decisions 5, 7, 8 and 9). It reads the
// document and places the annotations through the two calls the registered `check` makes,
// `readingOfProps` and `placesOf`, so that the reading and the places are made once per item (X-1 of
// the 5.11 review). The result is the draft's: the widget holds only the open card, which writes
// through as the user types (AD-9), and the message about the last refused passage; the marks, the
// pins and the cards stand on what the draft holds. A new card's passage is marked as soon as the
// card opens, so that the card has a pin to anchor to, and unmarked if it is closed empty.

import {
  ANNOTATION_MAX_CHARS,
  ANNOTATION_REPLACEMENT_MAX_CHARS,
  type AnnotationPlace,
  type DocumentReviewAnnotation,
  type DocumentReviewProps,
  placeQuote,
} from "@askboard/contract";
import { useHosted, useOpenLink, useReadyAfterLayout, useStrings } from "@askboard/view/catalog";
import { MARKDOWN } from "@askboard/view/markdown";
import { useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnnotationList, Card, Pin } from "../shared/annotations/index.ts";
import { DETACHED, DOCUMENT } from "./classes.ts";
import { PIN_ATTRIBUTE, useReviewDocument } from "./document-view.ts";
import { ReviewFrame, type Tool } from "./frame.tsx";
import { markSpecs } from "./marks.ts";
import {
  cardHolds,
  cardMatches,
  cardOf,
  type Card as OpenCard,
  placesOf,
  removeAnnotation,
  resultOf,
  withCard,
} from "./model.ts";
import { passageOf, startCard } from "./press.ts";
import { readingOfProps } from "./reading.ts";
import { counterText, isSuggestion, pinLabel, refusalText } from "./text.ts";

export type DocumentReviewWidgetProps = {
  readonly itemId: string;
  /** The agent's props, checked: the same object while the document stays. */
  readonly props: DocumentReviewProps;
  /** The result the item holds, as the draft gives it. */
  readonly result: unknown;
  /** The item may not change: answered, locked, a Snapshot, or a revision the board cannot show. */
  readonly disabled: boolean;
  readonly onResultChange: (result: unknown) => void;
  readonly ready: () => void;
};

const NONE: readonly DocumentReviewAnnotation[] = [];

const annotationsOf = (result: unknown): readonly DocumentReviewAnnotation[] => {
  if (typeof result !== "object" || result === null) return NONE;
  const list = (result as { annotations?: unknown }).annotations;
  return Array.isArray(list) ? (list as readonly DocumentReviewAnnotation[]) : NONE;
};

// A press of the toolbar's tools does not dismiss the open card: it opens the next one itself.
const isTool = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest("[data-review-tool]") !== null;

/** The open card, and whether it opened writing (a new passage) or reading (a pin). */
type Open = { readonly card: OpenCard; readonly editing: boolean };

export const DocumentReviewWidget = ({
  itemId,
  props,
  result,
  disabled,
  onResultChange,
  ready,
}: DocumentReviewWidgetProps) => {
  const say = useStrings();
  const hosted = useHosted();
  const openLink = useOpenLink();
  const titleId = useId();
  const editable = !disabled;
  const reading = useMemo(() => readingOfProps(props, window), [props]);
  const annotations = useMemo(() => annotationsOf(result), [result]);
  const places = placesOf(reading, annotations);
  const [opened, setOpen] = useState<Open | undefined>(undefined);
  const [message, setMessage] = useState("");

  // A card whose text the item does not hold, as after a revision that dropped the result, is closed.
  const open = opened !== undefined && cardMatches(opened.card, annotations) ? opened : undefined;
  if (opened !== undefined && open === undefined) setOpen(undefined);
  // The card now open, for a card that closes while another opens not to take the focus back.
  const openNow = useRef<Open | undefined>(undefined);
  openNow.current = open;

  // A card for a passage not yet held is marked as a comment for its pin; the places of the held
  // annotations stay the shared memo's, and only this one quote is placed here.
  const pending = open !== undefined && !annotations.some(({ id }) => id === open.card.id);
  const pendingCard = pending ? open.card : undefined;
  const specs = useMemo(() => {
    if (pendingCard === undefined) return markSpecs(places, annotations);
    const place = placeQuote(reading.text, pendingCard.quote);
    const added: AnnotationPlace[] = place.ok
      ? [{ id: pendingCard.id, status: "placed", start: place.start, end: place.end }]
      : [];
    const stand: DocumentReviewAnnotation = {
      id: pendingCard.id,
      target: { selector: pendingCard.quote },
      body: { text: "" },
    };
    return markSpecs([...places, ...added], [...annotations, stand]);
  }, [places, annotations, pendingCard, reading]);

  const dom = useReviewDocument({
    reading,
    specs,
    hosted,
    itemId,
    openLink,
    onSelect: (selected) => {
      if (selected?.ok === true) setMessage("");
    },
  });
  useReadyAfterLayout(ready, dom.applied !== undefined);

  const press = (tool: Tool): void => {
    const passage = passageOf(dom.selected(), dom.applied?.blocks ?? [], dom.current());
    const started = passage.ok
      ? startCard(tool, reading.text, annotations, places, passage)
      : ({ ok: false, refusal: passage.refusal, fromBlock: false } as const);
    if (!started.ok) {
      setMessage(refusalText(started.refusal, started.fromBlock, say));
      return;
    }
    setMessage("");
    setOpen({ card: started.card, editing: true });
  };

  const write = (next: OpenCard): void => {
    if (!editable) return;
    const list = withCard(annotations, next);
    // A card that holds an annotation the list cannot take is refused whole, and says why: typed
    // text never shows without reaching the draft.
    if (cardHolds(next) && list === annotations) {
      setMessage(refusalText({ code: "limit" }, false, say));
      return;
    }
    setOpen({ card: next, editing: open?.editing ?? true });
    if (list !== annotations) onResultChange(resultOf(list));
  };

  const remove = (id: string): void => {
    if (!editable) return;
    const list = removeAnnotation(annotations, id);
    setOpen(undefined);
    if (list !== annotations) onResultChange(resultOf(list));
  };

  const byId = new Map(annotations.map((annotation) => [annotation.id, annotation]));
  const marked = dom.applied?.marked;
  const cards = specs.flatMap((spec) => {
    const slot = marked?.pins.get(spec.id);
    const annotation = byId.get(spec.id);
    const isOpen = open?.card.id === spec.id;
    const shown: OpenCard | undefined = isOpen
      ? open.card
      : annotation === undefined
        ? undefined
        : cardOf(annotation);
    if (slot === undefined || shown === undefined) return [];
    // A pin opens its annotation's card reading; the pin of a card not yet held reopens that card.
    const target: OpenCard = annotation === undefined ? shown : cardOf(annotation);
    const label = pinLabel(isOpen ? shown.kind === "suggestion" : spec.suggested, spec.number, say);
    return [
      createPortal(
        <Card
          key={spec.id}
          anchor={
            <Pin
              {...{ [PIN_ATTRIBUTE]: "" }}
              number={spec.number}
              label={pinLabel(spec.suggested, spec.number, say)}
              tabIndex={-1}
              onClick={() => {
                setMessage("");
                setOpen({ card: target, editing: false });
              }}
            />
          }
          open={isOpen}
          onOpenChange={(next) => {
            if (!next) setOpen(undefined);
          }}
          onClose={() => setOpen(undefined)}
          returnFocus={() => (openNow.current === undefined ? dom.focusAfterCard(spec.id) : null)}
          keepOpenOn={isTool}
          label={label}
          comment={{
            value: shown.text,
            onChange: (value) => write({ ...shown, text: value }),
            max: ANNOTATION_MAX_CHARS,
          }}
          suggestion={
            shown.kind === "suggestion"
              ? {
                  value: shown.replacement,
                  onChange: (value) => write({ ...shown, replacement: value }),
                  max: ANNOTATION_REPLACEMENT_MAX_CHARS,
                }
              : undefined
          }
          startEditing={isOpen ? (open?.editing ?? false) : false}
          onDelete={editable ? () => remove(spec.id) : undefined}
          readOnly={!editable}
        />,
        slot as unknown as Element,
        spec.id,
      ),
    ];
  });

  const detached = places.flatMap((place, index) =>
    place.status === "detached" && annotations[index] !== undefined ? [annotations[index]] : [],
  ) as readonly DocumentReviewAnnotation[];
  const list =
    detached.length === 0 ? null : (
      <div className={DETACHED}>
        <AnnotationList
          heading={say("documentReview.detachedHeading")}
          note={say(editable ? "documentReview.detachedNote" : "documentReview.detachedNoteShown")}
          entries={detached.map((annotation, index) => ({
            id: annotation.id,
            label: pinLabel(isSuggestion(annotation), specs.length + index + 1, say),
            excerpt: annotation.target.selector.exact,
            text: [
              ...(typeof annotation.body.replacement === "string"
                ? [`${say("annotations.replaceWith")}: ${annotation.body.replacement}`]
                : []),
              ...(annotation.body.text === undefined ? [] : [annotation.body.text]),
            ].join("\n"),
            ...(editable ? { onDelete: () => remove(annotation.id) } : {}),
          }))}
        />
      </div>
    );

  return (
    <ReviewFrame
      say={say}
      title={props.title}
      titleId={titleId}
      editable={editable}
      counter={counterText(annotations, say)}
      message={message}
      onTool={press}
      list={list}
      document={
        <section
          ref={dom.container}
          aria-labelledby={props.title === undefined ? undefined : titleId}
          aria-label={props.title === undefined ? say("documentReview.document") : undefined}
          data-review-document=""
          data-text-format="markdown"
          className={`${MARKDOWN} ${DOCUMENT}`}
        />
      }
    >
      {cards}
    </ReviewFrame>
  );
};
