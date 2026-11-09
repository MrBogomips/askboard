// The content of an item frame's keys panel (keyboard-shortcuts-help, design decision 5; spec: The
// keys panel): the entries of the type's key table that have keys, by group, each with its action's
// name and its keys as key caps, in the board's language and as the platform writes them. Only the
// table and board strings reach it, never agent text (AD-8). An item that takes no edits lists
// only the entries that still act.

import type { KeyTable } from "@askboard/contract";
import { panelGroups } from "../catalog/keys/hint.ts";
import { useKeyPlatform, useStrings } from "../catalog/port.ts";

const GROUP = "flex flex-col gap-1";
const GROUP_TITLE = "text-body font-semibold text-foreground";
const ROW = "flex items-center justify-between gap-md text-body text-foreground";
const CAPS = "flex shrink-0 items-center gap-1";
const KEY_CAP = "rounded-sm border border-border bg-muted px-1 font-mono text-code text-foreground";

export const KeysPanelBody = ({
  table,
  takesEdits,
}: {
  readonly table: KeyTable;
  readonly takesEdits: boolean;
}) => {
  const text = useStrings();
  const platform = useKeyPlatform();
  return (
    <div className="flex flex-col gap-sm">
      {panelGroups(table, takesEdits, platform, text).map((group) => (
        <section key={group.id} className={GROUP} data-askboard-keys-group={group.id}>
          <h3 className={GROUP_TITLE}>{group.title}</h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {group.rows.map((row) => (
              <li key={`${row.name}:${row.caps.join(" ")}`} className={ROW}>
                <span>{row.name}</span>
                <span className={CAPS}>
                  {row.caps.map((cap) => (
                    <kbd key={cap} className={KEY_CAP}>
                      {cap}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
};
