// The image (excerpts, design decision 6; view spec, "Images by pointer", "Context counts for a
// visible question"): its bytes from the board document, through a `blob:` URL revoked when the
// image is gone, never a URL from the agent; ready once `decode()` settles. An unresolved image, or
// one the browser cannot decode, shows "Unresolved" with its pointer and its alt text, and is ready
// at once, so the rest of the board keeps working (AD-12). A shown image sits in a bordered frame on
// `muted` with a caption line, its alt text else its path (review F-24).

import { useEffect, useRef, useState } from "react";
import type { ItemProps } from "../port.ts";
import { useReadyAfterLayout } from "../port.ts";
import { ALT, IMAGE, IMAGE_CAPTION, IMAGE_FRAME, IMAGE_UNRESOLVED } from "./classes.ts";
import { Marked, UnresolvedRow } from "./marked.tsx";
import { type ImageView, imageCaptionOf, imageOf } from "./props.ts";

type Resolved = Extract<ImageView, { kind: "resolved" }>;

const bytesOf = (base64: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

const Unresolved = ({
  image,
  ready,
}: {
  readonly image: ImageView;
  readonly ready: () => void;
}) => {
  useReadyAfterLayout(ready);
  return (
    <div data-context="image" className={IMAGE_UNRESOLVED}>
      <UnresolvedRow pointer={image.pointer} />
      <p className={ALT}>
        <Marked text={image.alt} />
      </p>
    </div>
  );
};

// The image's `blob:` URL while it is shown: undefined until made, "failed" for bytes no blob takes.
const useBlobUrl = (image: Resolved): string | undefined | "failed" => {
  const [url, setUrl] = useState<string | undefined | "failed">(undefined);
  useEffect(() => {
    let made: string;
    try {
      made = URL.createObjectURL(new Blob([bytesOf(image.bytes)], { type: image.mediaType }));
    } catch {
      setUrl("failed");
      return undefined;
    }
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [image.bytes, image.mediaType]);
  return url;
};

const Shown = ({ image, ready }: { readonly image: Resolved; readonly ready: () => void }) => {
  const url = useBlobUrl(image);
  const element = useRef<HTMLImageElement>(null);
  const [decoded, setDecoded] = useState<"pending" | "done" | "failed">("pending");
  useEffect(() => {
    const shown = element.current;
    if (url === undefined || url === "failed" || shown === null) return undefined;
    let live = true;
    shown.decode().then(
      () => live && setDecoded("done"),
      () => live && setDecoded("failed"),
    );
    return () => {
      live = false;
    };
  }, [url]);
  const failed = url === "failed" || decoded === "failed";
  useReadyAfterLayout(ready, decoded === "done");
  if (failed) return <Unresolved image={image} ready={ready} />;
  return (
    <figure data-context="image" className={IMAGE_FRAME}>
      {url === undefined ? null : <img ref={element} src={url} alt={image.alt} className={IMAGE} />}
      <figcaption data-context-part="caption" className={IMAGE_CAPTION}>
        <bdi>
          <Marked text={imageCaptionOf(image)} />
        </bdi>
      </figcaption>
    </figure>
  );
};

export const Image = ({ item, ready }: ItemProps<{ readonly props: unknown }>) => {
  const image = imageOf(item.props);
  return image.kind === "resolved" ? (
    <Shown image={image} ready={ready} />
  ) : (
    <Unresolved image={image} ready={ready} />
  );
};
