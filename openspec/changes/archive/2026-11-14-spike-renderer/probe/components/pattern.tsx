import { useEffect, useState } from "react";
import { checkPattern } from "../pattern-check.ts";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";

type Case = { pattern: string; matches: string[]; misses: string[] };

// S-8 in the view: each accepted pattern is checked again and evaluated with `RegExp` against
// strings it must match and strings it must not, under the view CSP. The outcome is view state.
const PatternProbe = ({ item, emit, ready }: ItemProps) => {
  const [rows, setRows] = useState<string[]>([]);
  useEffect(() => {
    const cases = Array.isArray(item.props?.cases) ? (item.props.cases as Case[]) : [];
    const results = cases.map((c, index) => {
      const verdict = checkPattern(`${item.id}-${index}`, c.pattern);
      if (!verdict.ok) return `refused ${c.pattern}`;
      const regex = new RegExp(c.pattern, "u");
      const wrong = [...c.matches.filter((s) => !regex.test(s)), ...c.misses.filter((s) => regex.test(s))];
      return wrong.length ? `wrong ${c.pattern}: ${wrong.join(", ")}` : `ok ${c.pattern}`;
    });
    setRows(results);
    const ok = results.every((r) => r.startsWith("ok "));
    emit({ type: "ui.set", id: item.id, value: { ok, results } });
  }, [emit, item]);
  useReadyAfterLayout(ready, rows.length > 0);
  const ok = rows.length > 0 && rows.every((r) => r.startsWith("ok "));
  return (
    <div className="font-mono text-code">
      <p>{ok ? "all patterns behave as listed" : "some patterns misbehave"}</p>
      <ul>
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </div>
  );
};

register("PatternProbe", PatternProbe);
