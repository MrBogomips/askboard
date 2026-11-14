import { AlertDialog, Dialog as RadixDialog } from "radix-ui";
import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";
import { shimStyleElements } from "./_style-shim.ts";
import { text } from "./_field.tsx";

// S-6: Radix Dialog and Alert Dialog. Modal, they lock the page's scroll with a `<style>` they
// inject (react-remove-scroll-bar), trap focus and close on Esc; `props.modal: false` is the
// non-modal variant. Whether the dialog is open is view state in the draft record.
const content = "fixed left-1/2 top-24 w-96 -translate-x-1/2 rounded-md border border-border bg-popover p-4 shadow-md";
const button = "rounded-md border border-input bg-card px-2 py-1 text-control";

// `props.styleShim` adds the style-element shim (`_style-shim.ts`), S-6's measured change.
const Dialog = ({ item, ui, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  if (item.props?.styleShim === true) shimStyleElements();
  const modal = item.props?.modal !== false;
  const setOpen = (open: boolean) => emit({ type: "ui.set", id: item.id, value: open });
  return (
    <RadixDialog.Root open={ui === true} onOpenChange={setOpen} modal={modal}>
      <RadixDialog.Trigger className={button} data-open={item.id}>
        {text(item.props?.label, "Open dialog")}
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        {modal ? <RadixDialog.Overlay className="fixed inset-0 bg-foreground/30" /> : null}
        <RadixDialog.Content className={content} aria-describedby={undefined}>
          <RadixDialog.Title className="text-body-lg text-foreground">{text(item.props?.title, "Switch mode?")}</RadixDialog.Title>
          <input aria-label="Note" className="mt-2 w-full rounded-md border border-input px-2 py-1" />
          <div className="mt-3 flex gap-2">
            <RadixDialog.Close className={button}>Cancel</RadixDialog.Close>
            <button type="button" className={button} onClick={() => setOpen(false)}>
              Confirm
            </button>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
};

const Confirm = ({ item, ui, emit, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  if (item.props?.styleShim === true) shimStyleElements();
  const setOpen = (open: boolean) => emit({ type: "ui.set", id: item.id, value: open });
  return (
    <AlertDialog.Root open={ui === true} onOpenChange={setOpen}>
      <AlertDialog.Trigger className={button} data-open={item.id}>
        {text(item.props?.label, "Open alert dialog")}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-foreground/30" />
        <AlertDialog.Content className={content}>
          <AlertDialog.Title className="text-body-lg text-foreground">{text(item.props?.title, "Discard the draft?")}</AlertDialog.Title>
          <AlertDialog.Description className="text-body text-muted-foreground">It cannot be undone.</AlertDialog.Description>
          <div className="mt-3 flex gap-2">
            <AlertDialog.Cancel className={button}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action className={button}>Discard</AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
};

// A tall block, so the view has a page to scroll behind the dialog.
const Spacer = ({ item, ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  return <div className="h-[2400px] border-l-4 border-border pl-2 text-muted-foreground">{text(item.props?.text, "Long content")}</div>;
};

register("Dialog", Dialog);
register("AlertDialog", Confirm);
register("Spacer", Spacer);
