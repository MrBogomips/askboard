import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";

const Text = ({ item, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  return <p className="text-body text-foreground">{text(item.props?.text)}</p>;
};

register("Text", Text);
