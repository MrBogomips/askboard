// Negative probes for run `negative` (task 1.5): each does one thing AD-8's view CSP or sandbox
// must stop, and reports what the browser did as a `ui.set` view message. `CssomStyle` is the
// positive control: React's `style` prop writes through the CSSOM, which the CSP allows.

import { useEffect, useRef } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";

type Attempt = (element: HTMLElement) => unknown;

const outcomeOf = (attempt: Attempt, element: HTMLElement): Record<string, unknown> => {
  try {
    const result = attempt(element);
    return { outcome: "ran", result: result === undefined ? null : String(result) };
  } catch (error) {
    return { outcome: "threw", error: (error as Error).name, message: (error as Error).message };
  }
};

// Registered with a literal type name, so build.ts can list the chunk's components.
const probe = (name: string, attempt: Attempt) => {
  const Probe = ({ item, emit, ready }: ItemProps) => {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!ref.current) return;
      const report = outcomeOf(attempt, ref.current);
      emit({ type: "ui.set", id: item.id, value: { probe: name, ...report } });
    }, [emit, item.id]);
    useReadyAfterLayout(ready);
    return (
      <div ref={ref} className="text-body text-foreground">
        {`Probe ${name}`}
      </div>
    );
  };
  return Probe;
};

register(
  "NegStyleAttribute",
  probe("NegStyleAttribute", (el) => el.setAttribute("style", "color: red")),
);
register(
  "NegStyleElement",
  probe("NegStyleElement", () => {
    const style = document.createElement("style");
    style.textContent = ".neg-style { color: red }";
    document.head.append(style);
  }),
);
register(
  "NegInlineHandler",
  probe("NegInlineHandler", (el) => {
    el.setAttribute("onclick", "window.__inlineHandlerRan = true");
    el.click();
    return (window as unknown as { __inlineHandlerRan?: boolean }).__inlineHandlerRan === true;
  }),
);
register(
  "NegEval",
  probe("NegEval", () => (0, eval)("1 + 1")),
);
register(
  "NegFunction",
  probe("NegFunction", () => new Function("return 1")()),
);
register(
  "NegFetch",
  probe("NegFetch", () => {
    fetch("/leak/fetch").catch(() => undefined);
  }),
);
register(
  "NegForm",
  probe("NegForm", (el) => {
    const form = document.createElement("form");
    form.action = "/leak/form";
    form.method = "post";
    const field = document.createElement("input");
    field.name = "probe";
    field.value = "1";
    form.append(field);
    el.append(form);
    form.requestSubmit();
  }),
);
register(
  "NegLocalStorage",
  probe("NegLocalStorage", () => window.localStorage.getItem("probe")),
);
register(
  "NegWorker",
  probe("NegWorker", () => {
    const source = URL.createObjectURL(new Blob(["postMessage(1)"], { type: "text/javascript" }));
    return new Worker(source);
  }),
);

const CssomStyle = ({ ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  return (
    <div className="text-body" style={{ color: "var(--destructive-text)", paddingLeft: 8 }}>
      Styled through the CSSOM
    </div>
  );
};
register("CssomStyle", CssomStyle);
