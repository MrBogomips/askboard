// Harness items, not catalog components: `Hello` for the smoke run, `Delayed` for the ready
// rule (AD-9), `DelayedEarly`, its negative control, which reports ready before its async work
// has settled, so its box changes after ready, and `Throws`, a component that fails.

import { useEffect, useState } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

const Hello = ({ item, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  return <p className="text-question text-foreground">{text(item.props?.text, "Hello")}</p>;
};

const delayOf = (item: ItemProps["item"]): number =>
  typeof item.props?.ms === "number" ? item.props.ms : 500;

const useLoaded = (ms: number): string[] | null => {
  const [lines, setLines] = useState<string[] | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setLines(["Loaded line 1", "Loaded line 2", "Loaded line 3"]), ms);
    return () => clearTimeout(timer);
  }, [ms]);
  return lines;
};

const Loaded = ({ lines }: { lines: string[] | null }) =>
  lines ? (
    <ul className="text-body text-foreground">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  ) : (
    <p className="text-body text-muted-foreground">Loading…</p>
  );

const Delayed = ({ item, ready }: ItemProps) => {
  const lines = useLoaded(delayOf(item));
  useReadyAfterLayout(ready, lines !== null);
  return <Loaded lines={lines} />;
};

const DelayedEarly = ({ item, ready }: ItemProps) => {
  const lines = useLoaded(delayOf(item));
  useReadyAfterLayout(ready);
  return <Loaded lines={lines} />;
};

// Throws while rendering: how each renderer contains a failing component (AD-10).
const Throws = (_: ItemProps): never => {
  throw new Error("probe: this component always throws");
};

register("Hello", Hello);
register("Throws", Throws);
register("Delayed", Delayed);
register("DelayedEarly", DelayedEarly);
