// A chunk the `neg-chunk` fixture hashes in the view's policy but leaves out of the board page's
// (task 1.5): the inherited board policy must block it.

import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";

const NegChunk = ({ ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  return <p className="text-body text-foreground">This chunk ran</p>;
};

register("NegChunk", NegChunk);
