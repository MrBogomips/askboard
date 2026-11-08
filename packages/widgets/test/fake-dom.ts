// A small DOM for the Document review's pure modules (document-review, tasks 5.1 and 5.3): nodes
// with the structural reads and writes `reading.ts` and `marks.ts` use, so that they run in Bun,
// which has no DOM. Writing a `style` attribute or `innerHTML` throws, as the view's policy forbids
// both and the modules must never reach for them.

type Attributes = Map<string, string>;

export class FakeNode {
  readonly nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  parentNode: FakeNode | null = null;
  readonly childNodes: FakeNode[] = [];
  readonly attributes: Attributes = new Map();

  constructor(nodeType: number, nodeName: string, nodeValue: string | null = null) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.nodeValue = nodeValue;
  }

  get data(): string {
    return this.nodeValue ?? "";
  }

  set data(value: string) {
    this.nodeValue = value;
  }

  get length(): number {
    return this.data.length;
  }

  get nextSibling(): FakeNode | null {
    const siblings = this.parentNode?.childNodes ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  get innerHTML(): string {
    throw new Error("innerHTML was read");
  }

  set innerHTML(_: string) {
    throw new Error("innerHTML was written");
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    if (name === "style") throw new Error("a style attribute was written");
    this.attributes.set(name, value);
  }

  appendChild(child: FakeNode): FakeNode {
    return this.insertBefore(child, null);
  }

  insertBefore(child: FakeNode, before: FakeNode | null): FakeNode {
    child.parentNode?.childNodes.splice(child.parentNode.childNodes.indexOf(child), 1);
    child.parentNode = this;
    const at = before === null ? this.childNodes.length : this.childNodes.indexOf(before);
    this.childNodes.splice(at, 0, child);
    return child;
  }

  /** The text node's tail from `offset`, a new node after it; this node keeps the head. */
  splitText(offset: number): FakeNode {
    const tail = new FakeNode(3, "#text", this.data.slice(offset));
    this.nodeValue = this.data.slice(0, offset);
    this.parentNode?.insertBefore(tail, this.nextSibling);
    return tail;
  }

  contains(other: FakeNode): boolean {
    for (let at: FakeNode | null = other; at !== null; at = at.parentNode)
      if (at === this) return true;
    return false;
  }

  // A pre-order walk of the tree this node is in, from its topmost ancestor.
  private order(): FakeNode[] {
    let top: FakeNode = this;
    while (top.parentNode !== null) top = top.parentNode;
    const walk = (node: FakeNode): FakeNode[] => [node, ...node.childNodes.flatMap(walk)];
    return walk(top);
  }

  /** The DOM's bit mask: 2 preceding, 4 following, 8 contains, 16 contained by, 1 disconnected. */
  compareDocumentPosition(other: FakeNode): number {
    if (other === this) return 0;
    if (this.contains(other)) return 20;
    if (other.contains(this)) return 10;
    const order = this.order();
    const here = order.indexOf(this);
    const there = order.indexOf(other);
    if (there < 0) return 1 | 32 | 4;
    return there > here ? 4 : 2;
  }

  get textContent(): string {
    return this.nodeType === 3
      ? this.data
      : this.childNodes.map((child) => child.textContent).join("");
  }
}

/** A text node. */
export const text = (data: string): FakeNode => new FakeNode(3, "#text", data);

type Child = FakeNode | string;

/** An element of the given upper-case name, with attributes and children (strings are text). */
export const el = (
  name: string,
  attributes: Readonly<Record<string, string>>,
  ...children: readonly Child[]
): FakeNode => {
  const node = new FakeNode(1, name.toUpperCase());
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  for (const child of children) node.appendChild(typeof child === "string" ? text(child) : child);
  return node;
};

/** A document fragment holding the children. */
export const fragment = (...children: readonly Child[]): FakeNode => {
  const node = new FakeNode(11, "#document-fragment");
  for (const child of children) node.appendChild(typeof child === "string" ? text(child) : child);
  return node;
};

/** The factory `applyMarks` creates its nodes through; it logs every element it made. */
export const fakeDocument = (): {
  readonly made: FakeNode[];
  createElement(name: string): FakeNode;
  createTextNode(data: string): FakeNode;
} => {
  const made: FakeNode[] = [];
  return {
    made,
    createElement: (name) => {
      const node = new FakeNode(1, name.toUpperCase());
      made.push(node);
      return node;
    },
    createTextNode: (data) => text(data),
  };
};

/** The tree as markup-like text, for a test to read: `<p>a<b>b</b></p>`, attributes as `a=v`. */
export const show = (node: FakeNode): string => {
  if (node.nodeType === 3) return node.data;
  const attributes = [...node.attributes].map(([key, value]) => ` ${key}=${value}`).join("");
  const inner = node.childNodes.map(show).join("");
  return node.nodeType === 1
    ? `<${node.nodeName.toLowerCase()}${attributes}>${inner}</${node.nodeName.toLowerCase()}>`
    : inner;
};
