import type { ImgHTMLAttributes } from "react";
export default function Image({
  unoptimized: _unoptimized,
  priority,
  fill: _fill,
  alt = "",
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  unoptimized?: boolean;
  priority?: boolean;
  fill?: boolean;
}) {
  // The static preview serves these local assets without the Next.js loader.
  void _unoptimized;
  void _fill;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Static image adapter.
    <img {...props} alt={alt} loading={priority ? "eager" : (props.loading ?? "lazy")} />
  );
}
