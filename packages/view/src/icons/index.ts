// The icon module: the one place the view and the widgets get an icon from (DESIGN.md, Icons;
// icon-set design decision 3). Each export is named for its role on the board and is Lucide's icon
// imported by its path, so a later swap touches only this file. No wrapper, class or default prop:
// callers pass `className` for size and colour, and `role` with `aria-label` for a named mark.

export { default as IconNextOpen } from "lucide-react/icons/arrow-right";
// The answer ladder's states, the finished tab and the completion panel (answering-flow-guidance,
// design decision 11): decorative, beside the text that names the state.
export { default as IconDeclined } from "lucide-react/icons/ban";
export { default as IconCalendar } from "lucide-react/icons/calendar";
export { default as IconSelected, default as IconAreaDone } from "lucide-react/icons/check";
export { default as IconDelivered } from "lucide-react/icons/check-check";
export { default as IconDisclosure } from "lucide-react/icons/chevron-right";
export { default as IconToDo } from "lucide-react/icons/circle";
export { default as IconComplete } from "lucide-react/icons/circle-check-big";
export { default as IconPostponed } from "lucide-react/icons/clock";
export { default as IconExternal } from "lucide-react/icons/external-link";
export { default as IconDragHandle } from "lucide-react/icons/grip-vertical";
export { default as IconNotSentYet } from "lucide-react/icons/hourglass";
export { default as IconReplies } from "lucide-react/icons/message-square-reply";
export { default as IconReady } from "lucide-react/icons/package";
export { default as IconDraft } from "lucide-react/icons/pencil";
export { default as IconAgentChanged } from "lucide-react/icons/refresh-cw";
export { default as IconSent } from "lucide-react/icons/send";
export { default as IconClose } from "lucide-react/icons/x";
