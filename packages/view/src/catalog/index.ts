// `@askboard/view/catalog`: the `CatalogRenderer` port catalog components register through (AD-9).
// It offers only what `port.ts` exports, since the view build maps a component chunk's import of
// this entry to the shell's copy of that file; which component renders each item
// (`components.ts`) is for the renderer and `assemble` inside `view`.

export {
  type BoardContent,
  type BoardWidgetItem,
  type CatalogComponent,
  type ComponentFacts,
  componentFacts,
  componentFor,
  type DerivedValues,
  type ItemProps,
  questionTextId,
  register,
  registeredComponents,
  type Say,
  type Slots,
  type StringKey,
  say,
  useLanguage,
  useLocale,
  useReadyAfterLayout,
  useStrings,
} from "./port.ts";
