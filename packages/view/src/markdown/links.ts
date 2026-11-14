// The links in a Markdown Text (atoms, design decision 5; view-and-widgets spec: Markdown links in
// the view): which anchor a click landed on, what the click then does, and how a Snapshot's
// anchors open. The reads are structural so that the logic runs without a DOM.

/** What a click needs of the element it landed on. */
export type ClickTarget = { closest(selector: string): unknown };

/** What the container must say: whether a node is inside it. */
export type Container = { contains(node: never): boolean };

type Anchor = { getAttribute(name: string): string | null };

const isTarget = (value: unknown): value is ClickTarget =>
  typeof value === "object" && value !== null && "closest" in value;

const isAnchor = (value: unknown): value is Anchor =>
  typeof value === "object" && value !== null && "getAttribute" in value;

// An element a widget adds beside the agent's content (the Document review's pins and replacement
// text) carries this attribute (`UI_ATTRIBUTE` in `widgets`): a click on it is never a click on a
// link, whatever surrounds it (review X-1 of 6.5; AD-8, NFR-5).
const WIDGET_UI = "[data-review-ui]";

/**
 * The `href` of the anchor a click landed on, when the anchor is inside the container: markdown's
 * only anchors are the sanitizer's, with an `http:` or `https:` `href`. None for a target inside an
 * element a widget added (`[data-review-ui]`), so that a pin or a suggested replacement never opens
 * the link it might stand in.
 */
export const anchorHref = (target: unknown, container: Container): string | undefined => {
  if (!isTarget(target)) return undefined;
  if (target.closest(WIDGET_UI) !== null) return undefined;
  const anchor = target.closest("a[href]");
  if (!isAnchor(anchor) || !container.contains(anchor as never)) return undefined;
  return anchor.getAttribute("href") ?? undefined;
};

/** What the handler does with an event on a link. */
export type LinkAction = { readonly prevent: boolean; readonly open: boolean };

/**
 * On the board a click is prevented and asks the board page to open the link, and an auxclick is
 * prevented and opens nothing; in a Snapshot, which has no board page, the browser opens the link
 * by the anchor's own `target` and `rel`.
 */
export const linkAction = (event: "click" | "auxclick", hosted: boolean): LinkAction =>
  hosted ? { prevent: true, open: event === "click" } : { prevent: false, open: false };

/** Makes every anchor under `root` open in a new tab, with no opener and no referrer. */
export const markExternal = (root: {
  querySelectorAll(selector: string): Iterable<{ setAttribute(name: string, value: string): void }>;
}): void => {
  for (const anchor of root.querySelectorAll("a")) {
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  }
};

/** What `mountMarkdown` needs of the container: nodes put in, listeners on its anchors' clicks. */
export type MountTarget = Container & {
  replaceChildren(...nodes: never[]): void;
  addEventListener(type: "click" | "auxclick", listener: (event: LinkEvent) => void): void;
  removeEventListener(type: "click" | "auxclick", listener: (event: LinkEvent) => void): void;
};

/** The parts of a click the handler reads. */
export type LinkEvent = { readonly target: unknown; preventDefault(): void };

/** The fragment as the container's content; the work to undo when the content is replaced. */
export type Mounting = {
  readonly target: MountTarget;
  /** A copy of the sanitized fragment, which the container then holds. */
  readonly shown: unknown;
  readonly hosted: boolean;
  readonly itemId: string;
  readonly openLink: (itemId: string, url: string) => void;
};

/**
 * Puts the content in the container and listens for the clicks of its anchors, which are natively
 * keyboard operable: Enter on a focused link is a click. Returns the function that removes the
 * listeners.
 */
export const mountMarkdown = ({
  target,
  shown,
  hosted,
  itemId,
  openLink,
}: Mounting): (() => void) => {
  target.replaceChildren(shown as never);
  const handle = (kind: "click" | "auxclick") => (event: LinkEvent) => {
    const href = anchorHref(event.target, target);
    if (href === undefined) return;
    const action = linkAction(kind, hosted);
    if (action.prevent) event.preventDefault();
    if (action.open) openLink(itemId, href);
  };
  const onClick = handle("click");
  const onAuxClick = handle("auxclick");
  target.addEventListener("click", onClick);
  target.addEventListener("auxclick", onAuxClick);
  return () => {
    target.removeEventListener("click", onClick);
    target.removeEventListener("auxclick", onAuxClick);
  };
};
