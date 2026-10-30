import "../styles/scroll-lock.css";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";

// S-6's measured change, as its own chunk so a fixture can carry it or not: the chunk's
// stylesheet holds the scroll-lock rule. The item renders nothing.
const ScrollLockRule = ({ ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  return null;
};

register("ScrollLockRule", ScrollLockRule);
