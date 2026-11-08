// The shared annotation pieces (document-review, design decision 7; image-annotation's decision
// 9): the pin, the card and the list every annotating widget draws, which name no widget type. A
// chunk that imports them bundles them, as it bundles the other `shared/` modules.

export { Card, CardBody, type CardBodyProps, type CardField, type CardProps } from "./card.tsx";
export { AnnotationList, type ListEntry } from "./list.tsx";
export { Pin, type PinProps } from "./pin.tsx";
