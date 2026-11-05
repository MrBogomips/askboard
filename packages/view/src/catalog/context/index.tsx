// The context chunk (excerpts, design decision 6; proposal B14): it registers the three context
// items' components, `excerpt`, `reference` and `image`, through the `CatalogRenderer` port. The
// view hands an item's props over as data, unchecked: each component reads only the fields it
// shows (`props.ts`), fails on props that are no board document's (AD-10) and shows every string
// as text, never as markup (AD-8).

import { register } from "../port.ts";
import { Excerpt } from "./excerpt.tsx";
import { Image } from "./image.tsx";
import { Reference } from "./reference.tsx";

register("excerpt", Excerpt);
register("reference", Reference);
register("image", Image);
