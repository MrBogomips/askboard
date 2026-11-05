import { describe, expect, test } from "bun:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HostContext,
  useHosted,
  useOpenReference,
  useReadyAfterLayout,
  type ViewHost,
} from "./port.ts";

// The server renderer builds a layout effect's function with the browser's frame functions as
// defaults, though it never runs it.
Object.assign(globalThis, {
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
});

// A component that reads the host the shell provides and writes what it found as text.
const Probe = ({ onOpen }: { readonly onOpen: (itemId: string) => void }): ReactNode => {
  const hosted = useHosted();
  const open = useOpenReference();
  useReadyAfterLayout(() => {});
  if (hosted) open("probe");
  onOpen("read");
  return createElement("span", null, String(hosted));
};

const render = (host: ViewHost | undefined, onOpen: (itemId: string) => void): string =>
  renderToStaticMarkup(
    host === undefined
      ? createElement(Probe, { onOpen })
      : createElement(HostContext.Provider, { value: host }, createElement(Probe, { onOpen })),
  );

describe("what the view has of its host (excerpts, task 6.4 and 6.5)", () => {
  test("with no provider a component is hosted and its requests go nowhere", () => {
    const seen: string[] = [];
    expect(render(undefined, (itemId) => seen.push(itemId))).toBe("<span>true</span>");
  });

  test("the shell's host says whether the view has a parent and carries the request to open", () => {
    const opened: string[] = [];
    const hosted = render({ hosted: true, openReference: (id) => opened.push(id) }, () => {});
    expect(hosted).toBe("<span>true</span>");
    expect(opened).toEqual(["probe"]);
    const snapshot = render({ hosted: false, openReference: (id) => opened.push(id) }, () => {});
    expect(snapshot).toBe("<span>false</span>");
    expect(opened).toEqual(["probe"]);
  });
});
