import type { ImgHTMLAttributes } from "react";
export default function Image({
  unoptimized: _unoptimized,
  priority,
  fill: _fill,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & {
  unoptimized?: boolean;
  priority?: boolean;
  fill?: boolean;
}) {
  return (
    <img {...props} loading={priority ? "eager" : (props.loading ?? "lazy")} />
  );
}
