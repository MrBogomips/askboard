// The Document review's keys (view-and-widgets spec: A Document review at the keyboard; design
// decision 9; EXPERIENCE, Accessibility Floor), pure: Up, Down, Home and End move the current block,
// Left and Right move between the current block's pins. The document is one Tab stop, so no key
// here is Tab; every other key is left to the browser.

const BLOCK_KEYS: ReadonlySet<string> = new Set(["ArrowUp", "ArrowDown", "Home", "End"]);

/**
 * The block the key moves the current one to, or none for another key or a document with no block.
 * A `current` past the end is brought back first, since a revision can shorten the document.
 */
export const blockAfterKey = (count: number, current: number, key: string): number | undefined => {
  if (count <= 0 || !BLOCK_KEYS.has(key)) return undefined;
  const at = Math.min(Math.max(current, 0), count - 1);
  switch (key) {
    case "ArrowUp":
      return Math.max(at - 1, 0);
    case "ArrowDown":
      return Math.min(at + 1, count - 1);
    case "Home":
      return 0;
    default:
      return count - 1;
  }
};

/**
 * Where Left and Right take the focus among the current block's `count` pins: from the block
 * (`"block"`) or a pin to the next or previous pin, from the first pin back to the block, stopping
 * at the last; none for another key, or when there is no pin to go to.
 */
export const pinAfterKey = (
  count: number,
  from: number | "block",
  key: string,
): number | "block" | undefined => {
  if (key === "ArrowRight") {
    if (count <= 0) return undefined;
    return from === "block" ? 0 : Math.min(from + 1, count - 1);
  }
  if (key === "ArrowLeft") {
    if (from === "block" || count <= 0) return undefined;
    return from === 0 ? "block" : Math.min(from - 1, count - 1);
  }
  return undefined;
};
