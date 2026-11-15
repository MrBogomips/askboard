// `lucide` (the DOM package) has no exports map and types only its main entry, which the import
// rule refuses (`tools/check-imports.ts`): the two files the board page's icon module imports.
type LucideIconNode = [tag: string, attrs: Record<string, string | number | undefined>][];

declare module "lucide/dist/esm/createElement.mjs" {
  const createElement: (
    iconNode: LucideIconNode,
    attributes?: Record<string, string>,
  ) => SVGElement;
  export default createElement;
}

declare module "lucide/dist/esm/icons/x.mjs" {
  const X: LucideIconNode;
  export default X;
}
