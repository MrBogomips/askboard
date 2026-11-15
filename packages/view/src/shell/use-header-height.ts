// The header's height, for the strip of tabs that sticks under it (answering-flow-guidance, decision
// 4): read at mount and again whenever the header resizes (a narrower view wraps its second row).
// DOM only, so it is checked in the browser.

import { useEffect, useState } from "react";

/** The context header's height in whole CSS pixels; 0 before it has been measured. */
export const useHeaderHeight = (): number => {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const header = document.querySelector("header");
    if (header === null) return;
    const read = () => setHeight(Math.round(header.getBoundingClientRect().height));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return height;
};
