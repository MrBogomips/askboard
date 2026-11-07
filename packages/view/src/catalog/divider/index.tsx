// The Divider atom's chunk (atoms, design decisions 4 and 8; view-and-widgets spec: Display atoms;
// DESIGN.md: Divider): a 1px rule in the divider colour with `{spacing.md}` above and below. It is a
// separator (an `hr`'s own role), takes no focus, gives no answer and registers no facts; props the contract refuses
// fail the item (AD-10). It reports itself ready once it has been laid out (AD-9).

import { dividerPropsProblems } from "@askboard/contract";
import { type ItemProps, register, useReadyAfterLayout } from "../port.ts";

/** The catalog name, which is the Divider item's type. */
const DIVIDER = "divider";

type UncheckedDividerItem = {
  readonly type: "divider";
  readonly id: string;
  readonly props: unknown;
};

const Divider = ({ item, ready }: ItemProps<UncheckedDividerItem>) => {
  const problems = dividerPropsProblems(item.props);
  if (problems.length > 0) {
    const said = problems.map(({ path, message }) => `${path}: ${message}`).join("; ");
    throw new Error(`the Divider "${item.id}" refuses its props: ${said}`);
  }
  useReadyAfterLayout(ready);
  return <hr className="my-md border-0 border-t border-border" />;
};

register(DIVIDER, Divider);
