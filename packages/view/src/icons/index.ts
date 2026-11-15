// The icon module: the one place the view and the widgets get an icon from (DESIGN.md, Icons;
// icon-set design decision 3). Each export is named for its role on the board and is Lucide's icon
// imported by its path, so a later swap touches only this file. No wrapper, class or default prop:
// callers pass `className` for size and colour, and `role` with `aria-label` for a named mark.

export { default as IconNextOpen } from "lucide-react/icons/arrow-down";
export { default as IconCalendar } from "lucide-react/icons/calendar";
export { default as IconSelected } from "lucide-react/icons/check";
export { default as IconDisclosure } from "lucide-react/icons/chevron-right";
export { default as IconExternal } from "lucide-react/icons/external-link";
export { default as IconDragHandle } from "lucide-react/icons/grip-vertical";
export { default as IconReplies } from "lucide-react/icons/message-square-reply";
export { default as IconAgentChanged } from "lucide-react/icons/refresh-cw";
export { default as IconClose } from "lucide-react/icons/x";
