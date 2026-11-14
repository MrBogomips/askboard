import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";

const Stack = ({ ready, children }: ItemProps) => {
  useReadyAfterLayout(ready);
  return <div className="flex flex-col gap-3">{children}</div>;
};

register("Stack", Stack);
