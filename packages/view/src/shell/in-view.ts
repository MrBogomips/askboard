// The question in view while the user scrolls or moves focus (answering-flow-fixes, design
// decision 3; #181). Pure: the cards' boxes in, the question's ID out. The outline, the next-open
// jump and the tabs read the one `inView` of the draft, so this is the only rule for it.

/** A card in board order, with its vertical edges from the viewport's top. */
export type CardBox = { readonly id: string; readonly top: number; readonly bottom: number };

export type InViewInput = {
  /** The cards in board order; a card with an empty box (a hidden tab's) counts for nothing. */
  readonly cards: readonly CardBox[];
  /** The space between the bars, from the viewport's top. */
  readonly band: { readonly top: number; readonly bottom: number };
  /** The question whose card holds focus, if any. */
  readonly focused: string | undefined;
  /** The page is scrolled to its end. */
  readonly atEnd: boolean;
};

const overlaps = (card: CardBox, band: InViewInput["band"]): boolean =>
  card.top < band.bottom && card.bottom > band.top;

/**
 * The question in view. In order: the focused card while it overlaps the band; at the end of the
 * page, the last card that overlaps the band; the card crossing the reading line, a third of the
 * way down the band; the last card above the line; the first card. None without a card.
 */
export const questionInView = ({
  cards,
  band,
  focused,
  atEnd,
}: InViewInput): string | undefined => {
  const boxes = cards.filter((card) => card.bottom > card.top);
  const held = boxes.find((card) => card.id === focused);
  if (held !== undefined && overlaps(held, band)) return held.id;
  if (atEnd) {
    const last = boxes.findLast((card) => overlaps(card, band));
    if (last !== undefined) return last.id;
  }
  const line = band.top + (band.bottom - band.top) / 3;
  const crossing = boxes.find((card) => card.top <= line && line < card.bottom);
  if (crossing !== undefined) return crossing.id;
  return (boxes.findLast((card) => card.bottom <= line) ?? boxes[0])?.id;
};
