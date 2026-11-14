// Probe instrumentation, the view's first inline script (design decision 2). It records CSP
// violations, errors, storage and worker accesses, and hands every event to the board page by
// postMessage. A Snapshot has no parent: the events stay in `__probeEvents` for the driver.
// Not product code: a product view does not wrap the storage APIs.

type ProbeEvent = { askboardProbe: 1; kind: string; t: number; [key: string]: unknown };

const host = window.parent !== window ? window.parent : null;
const events: ProbeEvent[] = [];
const now = () => performance.timeOrigin + performance.now();

const post = (kind: string, data: Record<string, unknown> = {}): void => {
  const event: ProbeEvent = { askboardProbe: 1, kind, t: now(), ...data };
  events.push(event);
  if (!host) return;
  try {
    host.postMessage(event, "*");
  } catch (error) {
    events.push({ askboardProbe: 1, kind: "post-failed", t: now(), message: String(error) });
  }
};

document.addEventListener("securitypolicyviolation", (e) => {
  post("violation", {
    directive: e.effectiveDirective,
    violated: e.violatedDirective,
    blockedURI: e.blockedURI,
    sample: e.sample,
    source: e.sourceFile,
    line: e.lineNumber,
    column: e.columnNumber,
    disposition: e.disposition,
    policy: e.originalPolicy,
  });
});
window.addEventListener("error", (e) => {
  post("error", { message: e.message, source: e.filename, line: e.lineno });
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = e.reason as { message?: unknown } | undefined;
  post("rejection", { message: String(reason?.message ?? e.reason) });
});

// Records the access, then lets the browser's own result or error through.
const wrapGetter = (target: object, name: string, api: string): void => {
  const owner = [target, Object.getPrototypeOf(target)].find((o) =>
    Object.getOwnPropertyDescriptor(o, name),
  );
  const descriptor = owner && Object.getOwnPropertyDescriptor(owner, name);
  if (!descriptor?.get) {
    post("storage-absent", { api });
    return;
  }
  const { get, set } = descriptor;
  Object.defineProperty(target, name, {
    configurable: true,
    get() {
      try {
        const value = get.call(this);
        post("storage", { api, op: "get", outcome: "returned" });
        return value;
      } catch (error) {
        post("storage", { api, op: "get", outcome: "threw", error: (error as Error).name });
        throw error;
      }
    },
    set: set
      ? function (this: unknown, value: unknown) {
          try {
            set.call(this, value);
            post("storage", { api, op: "set", outcome: "returned" });
          } catch (error) {
            post("storage", { api, op: "set", outcome: "threw", error: (error as Error).name });
            throw error;
          }
        }
      : undefined,
  });
};

for (const name of ["localStorage", "sessionStorage", "indexedDB", "caches"]) {
  wrapGetter(window, name, name);
}
wrapGetter(Document.prototype, "cookie", "document.cookie");

const wrapConstructor = (name: "Worker" | "SharedWorker"): void => {
  const Original = window[name] as unknown as (new (...args: unknown[]) => object) | undefined;
  if (!Original) {
    post("worker-absent", { api: name });
    return;
  }
  const Wrapped = function (this: unknown, ...args: unknown[]) {
    try {
      const instance = new Original(...args);
      post("worker", { api: name, outcome: "constructed" });
      return instance;
    } catch (error) {
      post("worker", { api: name, outcome: "threw", error: (error as Error).name });
      throw error;
    }
  };
  Wrapped.prototype = Original.prototype;
  Object.defineProperty(window, name, { configurable: true, writable: true, value: Wrapped });
};
wrapConstructor("Worker");
wrapConstructor("SharedWorker");

// Style and link elements added after parsing: libraries that inject styles at run time (and a
// driver that does) show up here, whether or not the CSP lets them apply.
let parsed = false;
document.addEventListener("DOMContentLoaded", () => {
  parsed = true;
});
new MutationObserver((records) => {
  if (!parsed) return;
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node instanceof HTMLStyleElement || node instanceof HTMLLinkElement) {
        post("style-added", { tag: node.tagName.toLowerCase(), text: (node.textContent ?? "").slice(0, 160) });
      }
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });

Object.assign(window, { __probeEvents: events, __probe: { post, now, host } });
post("instrumented", { hasParent: host !== null, origin: self.origin });
