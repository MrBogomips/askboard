import { type ItemProps, register, useReadyAfterLayout } from "../port/index.ts";

// The Tailwind stylesheets (task 4.1): utilities of the kinds the components use, each on its own
// element, so the fixture can compare the computed styles with the tokens. The chunk stylesheet
// is built from this file alone, as every chunk's is.
const Swatches = ({ ready }: ItemProps) => {
  useReadyAfterLayout(ready);
  return (
    <div className="flex flex-col gap-2">
      <div id="tw-token" className="bg-primary text-primary-foreground">token colours</div>
      <div id="tw-opacity" className="bg-foreground/30">colour with opacity</div>
      <div id="tw-radius" className="rounded-md border border-border">radius and border</div>
      <div id="tw-type" className="text-question">question type scale</div>
      <div id="tw-arbitrary" className="w-[137px]">arbitrary value</div>
      <div id="tw-grid" className="grid grid-cols-3 gap-1">
        <span>a</span>
        <span>b</span>
        <span>c</span>
      </div>
      <div id="tw-data" data-state="on" className="data-[state=on]:font-semibold">data attribute variant</div>
      <div id="tw-dark" className="text-foreground dark:text-primary">dark variant</div>
      <div id="tw-mono" className="font-mono">monospace stack</div>
    </div>
  );
};

register("Swatches", Swatches);
