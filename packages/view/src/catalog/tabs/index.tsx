// The Tabs layout's chunk (layouts, design decision 7; view-and-widgets spec: Tabs inside a
// question, A tab holding a field to correct): Radix Tabs from the shared `radix` library chunk,
// with its automatic activation and its keys (the arrows, Home and End move between tabs and select;
// Tab leaves the tablist for the panel). The first tab is selected at mount, and again when the
// agent removes the selected one. The selection is the component's view state, never an edit and
// never in the draft (AD-9): a reload shows the first tab, the fields keep their draft. Every panel
// stays mounted and hidden but the selected one, so its items report ready and keep their draft; the
// list is named by the question's text. The triggers stay enabled on an answered or locked question
// and in a Snapshot. A tab whose items hold, at any depth, a field with an entry carries a
// `{colors.destructive}` dot after its title and the text "needs a correction" for assistive
// technology (NFR-10, AD-20). Titles are agent text, shown as text (AD-8). It reports itself ready
// after its first layout.

import { Tabs as RadixTabs } from "radix-ui";
import { useState } from "react";
import { rendererOf } from "../layouts/layout.ts";
import {
  type ItemProps,
  questionTextId,
  register,
  useReadyAfterLayout,
  useStrings,
} from "../port.ts";
import { needsCorrection, tabsOf } from "./model.ts";

/** The catalog name, which is the Tabs item's type. */
const TABS = "tabs";

type UncheckedTabsItem = {
  readonly type: "tabs";
  readonly id: string;
  readonly props: unknown;
};

const TRIGGER =
  "flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-md py-1.5 text-control text-muted-foreground " +
  "data-[state=active]:border-primary data-[state=active]:font-semibold data-[state=active]:text-primary-text " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

const PANEL =
  "flex flex-col gap-md pt-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
  "data-[state=inactive]:hidden";

const Tabs = ({ item, questionId, ready, board, renderItem }: ItemProps<UncheckedTabsItem>) => {
  const tabs = tabsOf(item.id, item.props);
  const render = rendererOf("Tabs layout", item.id, renderItem);
  const text = useStrings();
  const [chosen, choose] = useState<string | undefined>(undefined);
  // The first tab at mount, and when the agent removes the one chosen.
  const selected = tabs.some(({ id }) => id === chosen) ? (chosen as string) : (tabs[0]?.id ?? "");
  useReadyAfterLayout(ready);
  return (
    <RadixTabs.Root value={selected} onValueChange={choose} className="flex min-w-0 flex-col">
      <RadixTabs.List
        aria-labelledby={questionTextId(questionId)}
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((tab) => (
          <RadixTabs.Trigger key={tab.id} value={tab.id} className={TRIGGER}>
            <span className="max-w-48 truncate" title={tab.title}>
              {tab.title}
            </span>
            {needsCorrection(tab, board.entries) ? (
              <>
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-destructive" />
                <span className="sr-only"> {text("tabs.needsCorrection")}</span>
              </>
            ) : null}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {tabs.map((tab) => (
        <RadixTabs.Content key={tab.id} value={tab.id} forceMount className={PANEL}>
          {tab.items.map((child) => render(child))}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
};

register(TABS, Tabs);
