// The outbox's ledger (answering-flow-visual, design decision 4; EXPERIENCE.md, Counting): a `group`
// named by `bar.delivery` with four cells, "{count} {label}", for Drafts, Ready, Sent and Delivered.
// A cell whose count rises pulses for 150 ms (`styles/motion.css`, only where the user has no
// preference for less motion). Ready is a dash in "One by one" while nothing is held, described by
// `ledger.readyOff`. The counts come from `ledger.ts`; nothing here reads the ask state.

import { useEffect, useId, useRef, useState } from "react";
import { useStrings } from "../catalog/port.ts";
import type { StringKey } from "../strings/index.ts";
import type { Ledger } from "./ledger.ts";

const CELLS = [
  ["drafts", "ledger.drafts"],
  ["ready", "ledger.ready"],
  ["sent", "ledger.sent"],
  ["delivered", "ledger.delivered"],
] as const satisfies readonly (readonly [keyof Ledger, StringKey])[];

const Cell = ({
  name,
  label,
  count,
  description,
}: {
  readonly name: keyof Ledger;
  readonly label: string;
  readonly count: number | undefined;
  readonly description: string;
}) => {
  const described = useId();
  // The pulse: set when the count rises, cleared once its animation has run.
  const before = useRef(count);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    const rose = count !== undefined && before.current !== undefined && count > before.current;
    before.current = count;
    if (!rose) return;
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), 150);
    return () => window.clearTimeout(timer);
  }, [count]);
  return (
    <div
      data-askboard-ledger={name}
      data-askboard-pulse={pulse ? "" : undefined}
      aria-describedby={count === undefined ? described : undefined}
      className="flex min-w-0 items-baseline gap-1 rounded-md bg-muted px-sm py-1 text-body"
    >
      <span data-askboard-count="" className="font-semibold text-foreground">
        {count ?? "–"}
      </span>
      <span className="truncate text-muted-foreground">{label}</span>
      {count === undefined ? (
        <span id={described} className="sr-only">
          {description}
        </span>
      ) : null}
    </div>
  );
};

export const LedgerCells = ({ ledger }: { readonly ledger: Ledger }) => {
  const text = useStrings();
  return (
    <fieldset
      aria-label={text("bar.delivery")}
      className="m-0 grid min-w-0 grid-cols-2 gap-1 border-0 p-0"
    >
      {CELLS.map(([name, key]) => (
        <Cell
          key={name}
          name={name}
          label={text(key)}
          count={ledger[name]}
          description={text("ledger.readyOff")}
        />
      ))}
    </fieldset>
  );
};
