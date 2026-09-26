"use client";

import { useState } from "react";
import Image, { type ImageProps } from "next/image";
import { photoVariantUrl, type PhotoVariant } from "@/lib/photo-variants";

export default function TravelImage({ variant = "thumb", onError, ...props }: ImageProps & { variant?: PhotoVariant }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const original = props.src;
  const candidate = typeof original === "string"
    ? photoVariantUrl(original, variant, process.env.NEXT_PUBLIC_PHOTO_BASE_URL || "")
    : original;
  const src = candidate === failedUrl ? original : candidate;

  return <Image {...props} src={src} alt={props.alt} unoptimized onError={(event) => {
    if (typeof candidate === "string" && candidate !== original && src === candidate) setFailedUrl(candidate);
    onError?.(event);
  }} />;
}
