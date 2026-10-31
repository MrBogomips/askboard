// The predecessors panel's state (view spec, "Gantt predecessors"; proposal, open question 9): one
// task's panel at a time, holding its predecessors as the user checks and unchecks them; "Done" or
// Enter commits them through `edits.ts`, Escape restores, and either gives the focus back to the
// task's "Depends on" cell. What the panel holds is view state until it commits.

import { useCallback, useRef, useState } from "react";
import { setPredecessors } from "./model/edits.ts";
import { toggled } from "./model/predecessors.ts";
import type { GanttOwnProps, GanttRow } from "./model/tasks.ts";

export type Panel = {
  readonly taskId: string;
  /** The predecessors the panel holds, in the order the user checked them. */
  readonly held: readonly string[];
};

export type PanelState = {
  readonly panel: Panel | undefined;
  readonly open: (row: GanttRow) => void;
  readonly toggle: (taskId: string, checked: boolean) => void;
  readonly done: () => void;
  readonly cancel: () => void;
};

type PanelArgs = {
  readonly current: GanttOwnProps;
  readonly sent: GanttOwnProps;
  readonly onCommit: (value: GanttOwnProps) => void;
  /** Focuses a task's "Depends on" cell. */
  readonly focusCell: (taskId: string) => void;
};

export const usePanelState = (args: PanelArgs): PanelState => {
  const [panel, setPanel] = useState<Panel | undefined>(undefined);
  const latest = useRef(args);
  latest.current = args;
  const open = useCallback((row: GanttRow) => {
    setPanel({ taskId: row.id, held: row.dependencies });
  }, []);
  const toggle = useCallback((taskId: string, checked: boolean) => {
    setPanel((shown) => shown && { ...shown, held: toggled(shown.held, taskId, checked) });
  }, []);
  const close = useCallback((taskId: string) => {
    setPanel(undefined);
    latest.current.focusCell(taskId);
  }, []);
  const done = useCallback(() => {
    if (panel === undefined) return;
    const { current, sent, onCommit } = latest.current;
    onCommit(setPredecessors(current, sent, panel.taskId, panel.held));
    close(panel.taskId);
  }, [panel, close]);
  const cancel = useCallback(() => {
    if (panel !== undefined) close(panel.taskId);
  }, [panel, close]);
  return { panel, open, toggle, done, cancel };
};
