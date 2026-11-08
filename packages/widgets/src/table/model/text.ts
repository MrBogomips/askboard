// Text measured in code points, the unit of the Table's limits (the browser's `maxLength` counts
// UTF-16 units).

/** The first `max` code points of the text, never half of an astral character. */
export const cutCodePoints = (text: string, max: number): string => {
  const points = Array.from(text);
  return points.length <= max ? text : points.slice(0, max).join("");
};
