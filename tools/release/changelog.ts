// The section of CHANGELOG.md for one version (plugin-release, design decision 6): the release's
// preflight requires it and the release notes are its body. The heading is `## <version>`, with
// ` - <date>` after it as the file lays it out (Keep a Changelog); the section ends at the next
// second-level heading or the end of the file.

/** The body of the version's section, without blank lines around it; `undefined` when there is none. */
export const changelogSection = (text: string, version: string): string | undefined => {
  const lines = text.split(/\r?\n/);
  const heading = new RegExp(
    `^## ${version.replace(/[.\\^$*+?()[\]{}|]/g, "\\$&")}(?: - .*)?\\s*$`,
  );
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const body = end < 0 ? rest : rest.slice(0, end);
  while (body.length > 0 && body[0]?.trim() === "") body.shift();
  while (body.length > 0 && body[body.length - 1]?.trim() === "") body.pop();
  return body.join("\n");
};
