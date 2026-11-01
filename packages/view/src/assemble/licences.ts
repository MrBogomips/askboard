// A Snapshot's licence notices (snapshot design decision 4, open question B4; NFR-6): the notices
// the manifest gives for the chunks a Snapshot inlines, one per package and version, each with its
// text, for the `askboard-licences` block that ends the file. Plain ECMAScript only.

import type { LicenceNotice } from "@askboard/contract";
import type { SelectedChunk } from "./select.ts";

/** One notice as a Snapshot holds it: the licence's text in place of its file's path. */
export type InlinedLicence = {
  readonly package: string;
  readonly version: string;
  /** SPDX expression. */
  readonly licence: string;
  readonly text: string;
};

const keyOf = ({ package: name, version }: LicenceNotice): string => `${name}\u0000${version}`;

// By package, then version, in code-unit order: no locale, so the same input gives the same bytes.
const byPackage = (a: LicenceNotice, b: LicenceNotice): number => {
  const [first, second] = [keyOf(a), keyOf(b)];
  return first < second ? -1 : first > second ? 1 : 0;
};

/**
 * The notices of the selected chunks, one per package and version, sorted, each with its text from
 * `texts`, by the notice's path relative to the view build's folder. A missing text is an error
 * naming the file, the package and the chunk.
 */
export const licenceNotices = (
  selection: readonly SelectedChunk[],
  texts: Readonly<Record<string, string>>,
): readonly InlinedLicence[] => {
  const notices = new Map<string, { readonly notice: LicenceNotice; readonly chunk: string }>();
  for (const { name, chunk } of selection) {
    for (const notice of chunk.licences) {
      if (!notices.has(keyOf(notice))) notices.set(keyOf(notice), { notice, chunk: name });
    }
  }
  return [...notices.values()]
    .sort((a, b) => byPackage(a.notice, b.notice))
    .map(({ notice, chunk }) => {
      const text = Object.hasOwn(texts, notice.path) ? texts[notice.path] : undefined;
      if (text === undefined) {
        const what = `${notice.package} ${notice.version}, a notice of the chunk "${chunk}"`;
        throw new Error(`no licence text at ${notice.path} for ${what}`);
      }
      return { package: notice.package, version: notice.version, licence: notice.licence, text };
    });
};
