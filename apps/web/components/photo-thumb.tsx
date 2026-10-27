"use client";

import { useEffect, useRef, useState } from "react";
import type { UploadedPhoto } from "@/lib/api";

/**
 * A product photo in a list (shop grid, cart, the seller's products): the
 * small copy made at upload (~400 px), so a page of products doesn't cost a
 * buyer megabytes of mobile data. Photos uploaded before thumbnails existed
 * have no small copy: then the full photo is shown instead.
 */
export function PhotoThumb({ photo, className, lazy = false }: { photo: UploadedPhoto; className: string; lazy?: boolean }) {
  const [useFull, setUseFull] = useState(!photo.thumbUrl);
  const image = useRef<HTMLImageElement>(null);

  // The page is rendered on the server first: a missing thumbnail can fail
  // before React attaches onError, so look once it has.
  useEffect(() => {
    const element = image.current;
    if (element && element.complete && element.naturalWidth === 0) setUseFull(true);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- the seller's uploaded photo
    <img
      ref={image}
      src={useFull ? photo.url : photo.thumbUrl!}
      onError={() => setUseFull(true)}
      alt=""
      loading={lazy ? "lazy" : undefined}
      className={className}
    />
  );
}
