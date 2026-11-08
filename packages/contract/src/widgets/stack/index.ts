// The Stack (FR-13, layouts): items one under another. Its schema is standalone: it belongs to no
// schema set until the entry is registered (layouts, design decision 8), and nothing compiles it
// when this module loads.

export { STACK_MIN_ITEMS, STACK_SCHEMA_IDS, type StackItem, type StackProps } from "./constants.ts";
export { STACK_WIDGET } from "./widget.ts";
