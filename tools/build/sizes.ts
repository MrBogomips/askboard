// Chunk growth (Consistency Conventions, Tests; renderer row 18): `packages/view/chunk-sizes.json`
// records each chunk's bytes, its script and styles together, and the board page's under
// "board-page". The build fails when a chunk grows more than the margin over its recorded size, or
// has none recorded. A change that means the growth records the new sizes in the same commit, so
// the diff says so: `bun run build:view --record-sizes` rewrites the file from the build.

/** The growth over the recorded size that fails the build (design decision 7). */
export const SIZE_MARGIN = 0.1;

export const RECORD_SIZES_FLAG = "--record-sizes";

export type ChunkSizes = Readonly<Record<string, number>>;

const RECORD_HINT = `if the change means it, record the new sizes with "bun run build:view ${RECORD_SIZES_FLAG}" and commit packages/view/chunk-sizes.json`;

const bytes = (count: number): string => `${count.toLocaleString("en-US")} bytes`;

// Code-point order, the same in every locale.
const byName = (sizes: ChunkSizes): [string, number][] =>
  Object.entries(sizes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const recordedSize = (recorded: ChunkSizes, name: string): number | undefined =>
  Object.hasOwn(recorded, name) ? recorded[name] : undefined;

/** Why the built sizes fail against the recorded ones, each naming the chunk and both sizes. */
export const sizeProblems = (
  recorded: ChunkSizes,
  built: ChunkSizes,
  margin: number = SIZE_MARGIN,
): string[] => {
  const problems: string[] = [];
  for (const [name, size] of byName(built)) {
    const before = recordedSize(recorded, name);
    if (before === undefined) {
      problems.push(
        `the chunk "${name}" has no recorded size (${bytes(size)} now): ${RECORD_HINT}`,
      );
    } else if (size > before * (1 + margin)) {
      const percent = Math.round(margin * 100);
      problems.push(
        `the chunk "${name}" is ${bytes(size)}, more than ${percent}% over its recorded ${bytes(before)}: ${RECORD_HINT}`,
      );
    }
  }
  for (const [name] of byName(recorded)) {
    if (!Object.hasOwn(built, name)) {
      problems.push(`the chunk "${name}" is recorded but the build made none: ${RECORD_HINT}`);
    }
  }
  return problems;
};

/** Chunks that shrank past the margin: the record is stale, so a later growth would hide. */
export const sizeNotes = (
  recorded: ChunkSizes,
  built: ChunkSizes,
  margin: number = SIZE_MARGIN,
): string[] =>
  byName(built).flatMap(([name, size]) => {
    const before = recordedSize(recorded, name);
    if (before === undefined || size >= before * (1 - margin)) return [];
    return [
      `the chunk "${name}" is ${bytes(size)}, down from its recorded ${bytes(before)}: consider recording the new sizes`,
    ];
  });

/** The file's text: names sorted, one per line, so a diff shows each chunk that changed. */
export const formatSizes = (sizes: ChunkSizes): string =>
  `${JSON.stringify(Object.fromEntries(byName(sizes)), null, 2)}\n`;

const isSizes = (value: unknown): value is ChunkSizes =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every((size) => Number.isSafeInteger(size) && size >= 0);

/** The recorded sizes; none when the file does not exist yet. */
export const readSizes = async (file: string): Promise<ChunkSizes> => {
  const source = Bun.file(file);
  if (!(await source.exists())) return {};
  const value: unknown = await source.json();
  if (!isSizes(value)) throw new Error(`${file} is not a map of chunk names to byte counts`);
  return value;
};
