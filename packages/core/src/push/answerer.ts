// The expected answerer the context header shows (view spec, "The expected answerer in the
// header"; FR-19, FR-24; design decision 12): the ask's `expectedUser`, only when it differs from
// the session project's git user name, compared without case and surrounding spaces, or when the
// machine has no git user name.

const comparable = (name: string): string => name.trim().toLowerCase();

/** The name the header shows after "For:", or undefined when it shows none. */
export const expectedAnswerer = (
  expectedUser: string | undefined,
  gitUserName: string | undefined,
): string | undefined => {
  const expected = expectedUser?.trim();
  if (!expected) return undefined;
  const git = gitUserName?.trim();
  if (git && comparable(git) === comparable(expected)) return undefined;
  return expected;
};
