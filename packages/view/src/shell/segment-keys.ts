// The keys of a segmented control (settings-languages, design decision 10).

/** The index a key moves to from `at` among `count` segments; undefined for any other key. */
export const segmentAfterKey = (key: string, at: number, count: number): number | undefined => {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return (at + 1) % count;
    case "ArrowLeft":
    case "ArrowUp":
      return (at - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return undefined;
  }
};
