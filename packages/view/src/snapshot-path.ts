// How a saved Snapshot's path is shown (review F-06; EXPERIENCE.md, Board banner): project-relative,
// from the `.askboard` folder the server saves under, and cut with an ellipsis in the middle when
// it is still long, so that the start and the file's name stay. The tooltip and the copy keep the
// full path. Text only: a path is never markup.

/** The characters kept at the start and at the end of a path cut in the middle. */
export const MIDDLE_HEAD = 20;
export const MIDDLE_TAIL = 28;

const ASKBOARD = "/.askboard/";

/** The path from its `.askboard` folder; a path with none stays as it is. */
export const projectRelative = (path: string): string => {
  const at = path.indexOf(ASKBOARD);
  return at < 0 ? path : path.slice(at + 1);
};

/** The path as shown: project-relative, and cut in the middle when longer than head and tail. */
export const shownPath = (path: string): string => {
  const relative = projectRelative(path);
  return relative.length <= MIDDLE_HEAD + 1 + MIDDLE_TAIL
    ? relative
    : `${relative.slice(0, MIDDLE_HEAD)}…${relative.slice(-MIDDLE_TAIL)}`;
};
