import { initVirtualKeyboardInCurrentBrowsingContext, MathfieldElement } from "mathlive";
import "mathlive/fonts.css";
import { createElement, useEffect, useRef } from "react";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { text } from "./_field.tsx";
import { shimMarkupIn } from "./_markup-shim.ts";

// LaTeX editing on MathLive (EXPERIENCE.md, Atoms, optional). Its fonts and sounds load from
// URLs by default; both are switched off and the fonts come inlined in the chunk stylesheet.
// The field is controlled from the draft record: an edit is written there, and a draft value
// the field does not show is written back into it. `props.sandboxedKeyboard` is the measured
// change: in a frame, MathLive makes `window.mathVirtualKeyboard` a proxy that posts to the top
// window with the view's origin, "null" in the sandbox, which `postMessage` refuses. The change
// removes that proxy, mounts the keyboard in the view instead, and sets the keyboard policy to
// `sandboxed`.
let keyboardInFrame = false;
const mountKeyboardInFrame = () => {
  if (keyboardInFrame) return;
  keyboardInFrame = true;
  delete (window as { mathVirtualKeyboard?: unknown }).mathVirtualKeyboard;
  initVirtualKeyboardInCurrentBrowsingContext();
};
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;

const MathField = ({ item, draft, emit, ready }: ItemProps) => {
  const ref = useRef<MathfieldElement>(null);
  const value = text(draft, text(item.props?.initial));
  if (item.props?.sandboxedKeyboard === true) mountKeyboardInFrame();
  // MathLive writes its formula as markup with `style` attributes into the field's shadow root.
  if (item.props?.markupShim === true) shimMarkupIn("MATH-FIELD");
  useReadyAfterLayout(ready);
  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    if (field.value !== value) field.value = value;
    const onInput = () => emit({ type: "draft.set", id: item.id, value: field.value });
    field.addEventListener("input", onInput);
    return () => field.removeEventListener("input", onInput);
  }, [emit, item.id, value]);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label uppercase text-muted-foreground">{text(item.props?.label)}</span>
      {createElement("math-field", {
        ref,
        class: "ab-math-field rounded-md border border-input bg-card",
        ...(item.props?.sandboxedKeyboard === true ? { "math-virtual-keyboard-policy": "sandboxed" } : {}),
      })}
    </div>
  );
};

register("MathField", MathField);
