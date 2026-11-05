// The reference (excerpts, design decision 6; DESIGN.md, Reference; view spec, "References open in
// one click"): a bordered chip on two lines, the kind label (FILE, GITHUB, WEB) and the path or
// title, then the hint, the external-link mark only on a reference that opens in the browser. It is
// a button: a click or Enter sends `open-reference` naming its item, and the board page opens it
// from its own board document (task 6.5). With no parent host, the Snapshot look (task 6.4;
// EXPERIENCE, Snapshots): a FILE reference is text, "not available in a Snapshot", opening
// nothing, and a web reference is a link that opens in a new tab only on a click, with `noopener`
// and `noreferrer`.

import type { ItemProps } from "../port.ts";
import { useHosted, useOpenReference, useReadyAfterLayout } from "../port.ts";
import { HINT, LABEL, PATH, REFERENCE, REFERENCE_ROW, REFERENCE_STATIC } from "./classes.ts";
import { Marked } from "./marked.tsx";
import { type ReferenceView, referenceOf } from "./props.ts";

const Row = ({ reference }: { readonly reference: ReferenceView }) => (
  <span className={REFERENCE_ROW}>
    <span data-context-part="label" className={LABEL}>
      {reference.label}
    </span>
    <bdi data-context-part="path" className={PATH}>
      <Marked text={reference.shown} />
    </bdi>
  </span>
);

const Hint = ({ reference }: { readonly reference: ReferenceView }) =>
  reference.external ? (
    <span data-context-part="hint" className={HINT}>
      opens in browser{" "}
      <span data-context-part="external" aria-hidden="true">
        ↗
      </span>
    </span>
  ) : (
    <span data-context-part="hint" className={HINT}>
      opens in a reading panel
    </span>
  );

// A Snapshot has no board page to open a file in: the path stays as text.
const SnapshotFile = ({ reference }: { readonly reference: ReferenceView }) => (
  <div data-context="reference" title={reference.target} className={REFERENCE_STATIC}>
    <Row reference={reference} />
    <span data-context-part="hint" className={HINT}>
      not available in a Snapshot
    </span>
  </div>
);

const SnapshotLink = ({
  reference,
  href,
}: {
  readonly reference: ReferenceView;
  readonly href: string;
}) => (
  <a
    data-context="reference"
    title={reference.target}
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={REFERENCE}
  >
    <Row reference={reference} />
    <Hint reference={reference} />
  </a>
);

export const Reference = ({
  item,
  ready,
}: ItemProps<{ readonly id: string; readonly props: unknown }>) => {
  const hosted = useHosted();
  const openReference = useOpenReference();
  useReadyAfterLayout(ready);
  const reference = referenceOf(item.props);
  if (!hosted) {
    if (reference.href !== undefined)
      return <SnapshotLink reference={reference} href={reference.href} />;
    return <SnapshotFile reference={reference} />;
  }
  return (
    <button
      type="button"
      data-context="reference"
      title={reference.target}
      className={REFERENCE}
      onClick={() => openReference(item.id)}
    >
      <Row reference={reference} />
      <Hint reference={reference} />
    </button>
  );
};
