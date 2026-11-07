// One draw per task (latex-kanban-timeline, task 4.17; view-and-widgets spec: LaTeX previews one at a
// time; design decision 7, Many items). The bound on one expression's render is 2 seconds; a question
// of ten LaTeX items drawn in one task could hold the page for ten times that. Each item asks the
// chunk's queue for a draw: the queue runs one per task, in the order asked, so the board answers
// input between draws; an item's newer draw replaces its pending one in place; a draw the user's edit
// asked for goes before the draws that were not, and after earlier edits; an item that goes away drops
// its pending draw.

/** Runs `task` later, in a task of its own. */
export type Schedule = (task: () => void) => void;

/** What an ask may say besides the draw. */
export type AskOptions = {
  readonly edit?: boolean;
  readonly onError?: (error: unknown) => void;
};

export type RenderQueue = {
  /**
   * Asks for `draw` under `key`. A draw already pending under the key is replaced, keeping its place
   * unless this ask is an edit (then it joins the edits). `edit` marks a draw the user's typing asked.
   * `onError` receives what this draw throws, in place of the queue's own listener, so that an item
   * can fail itself (task 5.1); a draw asked again replaces it with the new ask's.
   */
  ask(key: string, draw: () => void, options?: AskOptions): void;
  /** Removes the draw pending under `key`, if any. */
  drop(key: string): void;
};

type Entry = {
  readonly key: string;
  draw: () => void;
  edit: boolean;
  onError: ((error: unknown) => void) | undefined;
};

/**
 * A queue that runs on `schedule`, one scheduled task at a time and none while it is empty. A draw
 * that throws is reported to `onError` (when given) and the queue goes on.
 */
export const createRenderQueue = (
  schedule: Schedule,
  onError?: (error: unknown) => void,
): RenderQueue => {
  // Edits first, in the order asked, then the rest in the order asked.
  const pending: Entry[] = [];
  let scheduled = false;

  const ensureScheduled = () => {
    if (scheduled || pending.length === 0) return;
    scheduled = true;
    schedule(run);
  };

  function run() {
    scheduled = false;
    const entry = pending.shift();
    try {
      entry?.draw();
    } catch (error) {
      try {
        (entry?.onError ?? onError)?.(error);
      } catch {
        // A listener that fails is no reason to stop the draws behind it.
      }
    } finally {
      ensureScheduled();
    }
  }

  const place = (entry: Entry) => {
    if (!entry.edit) {
      pending.push(entry);
      return;
    }
    const firstPlain = pending.findIndex((other) => !other.edit);
    pending.splice(firstPlain === -1 ? pending.length : firstPlain, 0, entry);
  };

  return {
    ask(key, draw, options) {
      const edit = options?.edit === true;
      const failure = options?.onError;
      const at = pending.findIndex((entry) => entry.key === key);
      const held = at === -1 ? undefined : pending[at];
      if (held === undefined) {
        place({ key, draw, edit, onError: failure });
      } else if (edit && !held.edit) {
        pending.splice(at, 1);
        place({ key, draw, edit: true, onError: failure });
      } else {
        held.draw = draw;
        held.onError = failure;
      }
      ensureScheduled();
    },
    drop(key) {
      const at = pending.findIndex((entry) => entry.key === key);
      if (at !== -1) pending.splice(at, 1);
    },
  };
};

/** The chunk's one queue: a draw runs in a task of its own, after a timeout of 0. */
export const renderQueue: RenderQueue = createRenderQueue((task) => {
  setTimeout(task, 0);
});
