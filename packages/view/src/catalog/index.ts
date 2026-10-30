// `@askboard/view/catalog`: the `CatalogRenderer` port catalog components register through (AD-9),
// and which component renders each item.

export { CHOICE, componentOf, componentsOf } from "./components.ts";
export {
  type CatalogComponent,
  componentFor,
  type ItemProps,
  questionTextId,
  register,
  registeredComponents,
  useReadyAfterLayout,
} from "./port.ts";
