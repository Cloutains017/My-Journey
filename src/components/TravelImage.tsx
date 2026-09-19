import Image, { type ImageProps } from "next/image";

/** Optimize our photo stores; keep externally linked covers compatible. */
export default function TravelImage(props: ImageProps) {
  const bases = [
    process.env.NEXT_PUBLIC_PHOTO_BASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/trip-photos`
      : undefined,
  ];
  const src = typeof props.src === "string" ? props.src : null;
  const canOptimize = src === null || (src.startsWith("/") && !src.startsWith("//")) || bases.some(
    (base) => base && src.startsWith(`${base.replace(/\/$/, "")}/`) && !src.includes("?"),
  );
  return <Image {...props} alt={props.alt} unoptimized={props.unoptimized || !canOptimize} />;
}
