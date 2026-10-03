"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { photoVariantUrl, type PhotoVariant } from "@/lib/photo-variants";

export default function TravelImage({ variant = "thumb", onError, onLoad, className, ...props }: ImageProps & { variant?: PhotoVariant }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<ImageProps["src"] | null>(null);
  const [brokenSrc, setBrokenSrc] = useState<ImageProps["src"] | null>(null);
  const original = props.src;
  const candidate = typeof original === "string"
    ? photoVariantUrl(original, variant, process.env.NEXT_PUBLIC_PHOTO_BASE_URL || "")
    : original;
  const src = candidate === failedUrl ? original : candidate;

  return <Image {...props} src={src} alt={props.alt} unoptimized decoding={props.decoding || "async"}
    className={`travel-image ${className || ""}`} data-image-state={brokenSrc === src ? "error" : loadedSrc === src ? "ready" : "loading"}
    onLoad={event => { setLoadedSrc(src); setBrokenSrc(null); onLoad?.(event); }} onError={(event) => {
    if (typeof candidate === "string" && candidate !== original && src === candidate) {
      setFailedUrl(candidate);
      return;
    }
    if (brokenSrc !== src) { setBrokenSrc(src); onError?.(event); }
  }} />;
}
