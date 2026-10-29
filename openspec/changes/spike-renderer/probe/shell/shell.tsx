// The shell chunk (design decision 3): React, ReactDOM, the port and the ready tracker, exposed
// on one global for the other chunks. It boots from the `askboard-data` block once every chunk
// has registered, and answers the probe commands the board page relays from the driver.

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";
import * as JSXRuntime from "react/jsx-runtime";
import * as port from "../port/index.ts";
import type { BoardDocument, Draft, Item, RenderContext, ViewMessage } from "../port/index.ts";

type Probe = { post: (kind: string, data?: Record<string, unknown>) => void; now: () => number };
type Data = { board: BoardDocument; draft?: Draft; renderer: string; theme?: string };

const probe = (window as unknown as { __probe: Probe }).__probe;

const jsxDev = (type: React.ElementType, props: Record<string, unknown>, key?: React.Key) =>
  JSXRuntime.jsx(type, props, key);

Object.assign(window, {
  __askboard: {
    modules: {
      react: React,
      "react-dom": ReactDOM,
      "react-dom/client": ReactDOMClient,
      "react/jsx-runtime": JSXRuntime,
      "react/jsx-dev-runtime": { jsxDEV: jsxDev, Fragment: JSXRuntime.Fragment },
      port,
    },
  },
});

const itemIds = (items: Item[]): string[] =>
  items.flatMap((item) => [item.id, ...itemIds(item.children ?? [])]);

const boxOf = (id: string) => {
  const element = document.querySelector(`[data-item-id="${id}"]`);
  if (!element) return null;
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
};

// One generation per mount: ready and visible events carry it, so a remount is told apart.
const createTracker = (ids: string[], generation: number) => {
  const pending = new Set(ids);
  const callbacks = new Map<string, () => void>();
  const readyFor = (id: string) => {
    const existing = callbacks.get(id);
    if (existing) return existing;
    const callback = () => {
      if (!pending.has(id)) return;
      pending.delete(id);
      probe.post("ready", { id, generation, box: boxOf(id) });
      if (pending.size > 0) return;
      const boxes = () => Object.fromEntries(ids.map((itemId) => [itemId, boxOf(itemId)]));
      probe.post("visible", { generation, items: ids.length, boxes: boxes() });
      // The ready rule holds if nothing moves once the question counts as visible.
      setTimeout(() => probe.post("boxes", { generation, boxes: boxes() }), 1000);
    };
    callbacks.set(id, callback);
    return callback;
  };
  return { readyFor };
};

let root: ReactDOMClient.Root | null = null;
let generation = 0;
let context: RenderContext | null = null;
let rendererName = "own";

const mount = (): void => {
  if (!context) return;
  const Renderer = port.rendererFor(rendererName);
  const element = document.getElementById("root");
  if (!Renderer || !element) {
    probe.post("boot-failed", { reason: Renderer ? "no #root" : `no renderer ${rendererName}` });
    return;
  }
  generation += 1;
  const tracker = createTracker(itemIds(context.board.items), generation);
  context = { ...context, tracker };
  root = ReactDOMClient.createRoot(element);
  probe.post("mount", { generation, renderer: rendererName });
  root.render(<Renderer context={context} />);
};

const unmount = (): void => {
  root?.unmount();
  root = null;
};

const applyTheme = (theme: string | undefined): void => {
  const dark =
    theme === "dark" ||
    ((theme ?? "system") === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
};

const boot = (): void => {
  const block = document.getElementById("askboard-data");
  if (!block?.textContent) {
    probe.post("boot-failed", { reason: "no askboard-data block" });
    return;
  }
  const data = JSON.parse(block.textContent) as Data;
  rendererName = data.renderer;
  applyTheme(data.theme);
  const draft = port.createDraftStore(data.draft ?? { values: {}, ui: {} });
  // A renderer may already have written the draft (json-render's store adapter does).
  const emit = (message: ViewMessage): void => {
    const current = draft.get();
    const branch = message.type === "draft.set" ? current.values : current.ui;
    if (!Object.is(branch[message.id], message.value)) {
      const update = message.type === "draft.set" ? port.withValue : port.withUi;
      draft.replace(update(current, message.id, message.value));
    }
    probe.post("emit", { message });
  };
  const tracker = { readyFor: () => () => {} };
  context = { board: data.board, draft, graph: {}, emit, tracker };
  probe.post("boot", { renderer: rendererName, components: port.registeredTypes() });
  mount();
};

// Values the DOM serialization does not carry: typed text, checked state.
const formValues = (): Record<string, unknown> =>
  Object.fromEntries(
    [...document.querySelectorAll("#root input, #root textarea, #root select")].map((el, i) => {
      const field = el as HTMLInputElement;
      return [field.id || `${field.tagName.toLowerCase()}-${i}`, [field.value, field.checked]];
    }),
  );

const commands: Record<string, (args: Record<string, unknown>) => Record<string, unknown>> = {
  dump: () => ({
    html: document.getElementById("root")?.innerHTML ?? "",
    values: formValues(),
    draft: context?.draft.get(),
  }),
  remount: () => {
    unmount();
    mount();
    return { generation };
  },
  // Also whether every hashed <style> applied, and the token-driven page background.
  check: ({ selector, text }) => {
    const element = document.querySelector(String(selector));
    const content = element?.textContent ?? null;
    const styles = {
      elements: document.querySelectorAll("style").length,
      applied: document.styleSheets.length,
      background: getComputedStyle(document.documentElement).backgroundColor,
    };
    const ok = (content?.includes(String(text)) ?? false) && styles.applied === styles.elements;
    return { found: element !== null, content, styles, ok };
  },
};

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const data = event.data as { askboardProbeCommand?: string; id?: number; args?: object };
  const command = data?.askboardProbeCommand && commands[data.askboardProbeCommand];
  if (!command) return;
  const result = command((data.args ?? {}) as Record<string, unknown>);
  probe.post("command", { command: data.askboardProbeCommand, id: data.id, result });
});

// Every chunk is a synchronous inline script, so all have registered by DOMContentLoaded.
document.addEventListener("DOMContentLoaded", boot);
