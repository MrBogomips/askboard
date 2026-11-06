// The settings panel (settings-languages, design decision 10; DESIGN.md, Settings panel): a
// non-modal side sheet the board page renders, since the view cannot show a panel over itself and
// the board stays usable while it is open. It holds the presentation keys as segmented controls
// (WAI-ARIA radio groups with arrow keys, Home and End), the Language indicator, and the
// behaviour keys as read-only rows under "Applies from the next session". Esc or the close
// control dismisses it. Everything is built from text nodes (AD-8): no markup is parsed. The text
// comes from `settings-panel-data.ts`; each new data replaces the content and keeps the focus on
// the same segment.

import type { PresentationSetting } from "@askboard/contract";
import { SEGMENT, SEGMENTS } from "../shell/segment-classes.ts";
import { segmentAfterKey } from "../shell/segment-keys.ts";
import { element } from "./page-chrome.ts";
import type { PanelControl, PanelData, PanelRow } from "./settings-panel-data.ts";

/** What the panel does with the user's acts. */
export type PanelActions = {
  readonly choose: (setting: PresentationSetting) => void;
  readonly close: () => void;
};

export type SettingsPanel = {
  /** Shows the panel with this content, opening it first if it is closed; undefined closes it. */
  show(data: PanelData | undefined): void;
};

// `reading-panel`'s form: at the right edge, from under the context header's two rows down to the
// bottom action bar, on the popover surface with a left border and the large shadow.
const SHEET =
  "fixed right-0 top-[calc(var(--header-row)*2)] bottom-[var(--bottom-bar)] z-10 flex w-[560px] max-w-full " +
  "flex-col border-l border-border bg-popover text-foreground shadow-lg";
const HEADER = "flex items-center justify-between gap-md border-b border-border px-lg py-sm";
const BODY = "flex min-h-0 flex-1 flex-col gap-lg overflow-y-auto p-lg";
const GROUP = "flex flex-col gap-md border-b border-border pb-lg last:border-b-0";
const LABEL = "text-label uppercase text-muted-foreground";
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";
const BUTTON = `h-control-height shrink-0 rounded-md border border-border bg-muted px-md text-control text-foreground hover:bg-card ${FOCUS_RING}`;
const READ_ONLY = "flex flex-col gap-1 rounded-md bg-muted p-sm";
const CODE = "break-all font-mono text-code";
const ERROR = "text-body text-destructive-text";

const segmentedControl = (
  document: Document,
  control: PanelControl,
  choose: PanelActions["choose"],
): HTMLElement => {
  const group = element(document, "span", SEGMENTS);
  group.setAttribute("role", "radiogroup");
  group.setAttribute("aria-label", control.label);
  const readOnly = control.fixedBy !== undefined;
  const pick = (value: string) => choose({ key: control.key, value } as PresentationSetting);
  const buttons = control.segments.map((segment, at) => {
    const button = element(document, "button", SEGMENT, segment.label);
    button.type = "button";
    button.setAttribute("role", "radio");
    button.setAttribute("aria-checked", String(segment.value === control.value));
    button.tabIndex = segment.value === control.value ? 0 : -1;
    button.disabled = readOnly;
    button.dataset.askboardSegment = `${control.key}:${segment.value}`;
    button.addEventListener("click", () => pick(segment.value));
    button.addEventListener("keydown", (event) => {
      const next = segmentAfterKey(event.key, at, control.segments.length);
      const target = next === undefined ? undefined : control.segments[next];
      if (next === undefined || target === undefined) return;
      event.preventDefault();
      buttons[next]?.focus();
      pick(target.value);
    });
    return button;
  });
  group.append(...buttons);
  if (control.fixedBy !== undefined) {
    const why = element(document, "span", "sr-only", control.fixedBy);
    why.id = `askboard-fixed-${control.key}`;
    group.title = control.fixedBy;
    group.setAttribute("aria-describedby", why.id);
    group.append(why);
  }
  return group;
};

const presentationRow = (
  document: Document,
  control: PanelControl,
  choose: PanelActions["choose"],
): HTMLElement => {
  const row = element(document, "div", "flex flex-col gap-1");
  row.dataset.askboardSetting = control.key;
  const line = element(document, "div", "flex items-center justify-between gap-md");
  line.append(
    element(document, "span", LABEL, control.label),
    segmentedControl(document, control, choose),
  );
  row.append(line);
  if (control.fixedBy !== undefined) row.append(element(document, "p", CODE, control.fixedBy));
  if (control.error !== undefined) {
    const error = element(document, "p", ERROR, control.error);
    error.setAttribute("role", "alert");
    row.append(error);
  }
  return row;
};

const readOnlyRow = (document: Document, row: PanelRow): HTMLElement => {
  const shown = element(document, "div", READ_ONLY);
  shown.dataset.askboardSetting = row.key;
  shown.append(
    element(document, "span", LABEL, row.label),
    element(document, "span", CODE, row.value),
    element(document, "span", `${CODE} text-muted-foreground`, row.source),
  );
  if (row.alsoIn !== undefined) {
    shown.append(element(document, "span", `${CODE} text-muted-foreground`, row.alsoIn));
  }
  for (const warning of row.warnings) shown.append(element(document, "span", ERROR, warning));
  return shown;
};

const bodyOf = (
  document: Document,
  data: PanelData,
  choose: PanelActions["choose"],
): HTMLElement[] => {
  const presentation = element(document, "section", GROUP);
  presentation.append(
    ...data.controls.map((control) => presentationRow(document, control, choose)),
  );
  const language = element(document, "section", GROUP);
  const indicator = element(document, "div", READ_ONLY);
  indicator.dataset.askboardSetting = "language";
  indicator.append(
    element(document, "span", LABEL, data.languageLabel),
    element(document, "span", "text-body", data.language),
  );
  language.append(indicator);
  const behaviour = element(document, "section", GROUP);
  for (const problem of data.notApplied) {
    const notice = element(document, "p", ERROR, problem);
    notice.dataset.askboardSettingsFile = "";
    behaviour.append(notice);
  }
  behaviour.append(
    element(document, "p", "text-body text-muted-foreground", data.nextSession),
    ...data.rows.map((row) => readOnlyRow(document, row)),
  );
  for (const warning of data.warnings) behaviour.append(element(document, "p", ERROR, warning));
  return [presentation, language, behaviour];
};

/** The focused segment's identity, so that a rebuild can put the focus back on it. */
const focusedSegment = (document: Document, sheet: HTMLElement): string | undefined => {
  const active = document.activeElement;
  return active instanceof HTMLElement && sheet.contains(active)
    ? active.dataset.askboardSegment
    : undefined;
};

const sheetOf = (document: Document, data: PanelData, actions: PanelActions): HTMLElement => {
  const aside = element(document, "aside", SHEET);
  aside.setAttribute("aria-label", data.title);
  aside.dataset.askboardSettingsPanel = "";
  const close = element(document, "button", BUTTON, "✕");
  close.type = "button";
  close.setAttribute("aria-label", data.closeLabel);
  close.dataset.askboardSettingsClose = "";
  close.addEventListener("click", actions.close);
  const header = element(document, "header", HEADER);
  header.append(element(document, "h2", "text-body font-semibold", data.title), close);
  const body = element(document, "div", BODY);
  body.append(...bodyOf(document, data, actions.choose));
  aside.append(header, body);
  aside.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    actions.close();
  });
  return aside;
};

/** The panel over the board page's body, closed until shown. */
export const createSettingsPanel = (
  document: Document,
  frame: HTMLIFrameElement,
  actions: PanelActions,
): SettingsPanel => {
  let sheet: HTMLElement | undefined;
  return {
    show: (data) => {
      if (data === undefined) {
        sheet?.remove();
        sheet = undefined;
        return;
      }
      const previous = sheet;
      const refocus = previous === undefined ? undefined : focusedSegment(document, previous);
      const next = sheetOf(document, data, actions);
      if (previous === undefined) document.body.append(next);
      else previous.replaceWith(next);
      sheet = next;
      if (previous === undefined) {
        // Firefox keeps the focus in the view's frame unless the frame gives it up first.
        if (document.activeElement === frame) frame.blur();
        next.querySelector<HTMLElement>('[role="radio"][tabindex="0"]:not(:disabled)')?.focus();
      } else if (refocus !== undefined) {
        next.querySelector<HTMLElement>(`[data-askboard-segment="${refocus}"]`)?.focus();
      }
    },
  };
};
