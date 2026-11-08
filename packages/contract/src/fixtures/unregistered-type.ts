// A type name no widget will ever take (table-widget, review S-3 of review-table-g6): the tests that
// check an item of a type the input format does not define use it, so registering an FR-11 widget
// (the Spreadsheet, for one) never turns them into props refusals. Tests only.

/** An item type that no widget may be registered under. */
export const UNREGISTERED_TYPE = "no-such-widget";
