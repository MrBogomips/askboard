// Helpers for the registry tests of ask-core (widget-registry, group 3): a board model holding the
// test-only `probe` item, and the acts context that reads it through `PROBE_TYPES`. The shipped
// `AskCore` takes the shipped registry only, so these tests call the units that take a registry.

import type { LifecycleAskInput, WidgetType } from "@askboard/contract";
import { PROBE_SESSION, PROBE_TYPES, PROBE_WIDGET } from "@askboard/contract/fixtures";
import { type ActsContext, eventsOfActs } from "../src/lifecycle/acts.ts";
import { EventLog } from "../src/lifecycle/log.ts";
import { BoardModel } from "../src/lifecycle/model.ts";
import type { ExpansionMap } from "../src/molecules/map.ts";
import { WHEN } from "./lifecycle-fakes.ts";

export type Json = Record<string, unknown>;
export type Item = { type: string; id: string; props: unknown };

/** The probe item of the fixtures: options `a` and `b`, under the ID `pick`. */
export const PROBE_ITEM: Item = structuredClone(PROBE_WIDGET.example.item);

/** An ask whose questions hold the given items, one question each, `choose` first. */
export const modelOf = (...questions: readonly (readonly Item[])[]): BoardModel =>
  BoardModel.of(
    questions.map((items, at) => ({
      type: "question",
      id: at === 0 ? PROBE_SESSION.question : `other-${at}`,
      props: { text: "Which one?", items },
    })) as unknown as LifecycleAskInput["items"],
  );

/** An answer act on `choose` at revision 1; `fields` are its widget content. */
export const answerAct = (fields: Json, itemId: string = PROBE_SESSION.question): Json => ({
  type: "answer",
  itemId,
  rev: 1,
  when: WHEN,
  ...fields,
});

/** The acts of one command checked as ask-core checks them, over the probe registry. */
export const checked = (
  model: BoardModel,
  acts: readonly unknown[],
  options: {
    readonly expansion?: ExpansionMap;
    readonly log?: EventLog;
    readonly types?: readonly WidgetType[];
  } = {},
) => {
  const log = options.log ?? new EventLog();
  const context: ActsContext = {
    epoch: PROBE_SESSION.epoch,
    who: "Sara Conti",
    model,
    log,
    expansion: options.expansion ?? new Map(),
    types: options.types ?? PROBE_TYPES,
  };
  return { log, outcome: eventsOfActs(context, acts) };
};
