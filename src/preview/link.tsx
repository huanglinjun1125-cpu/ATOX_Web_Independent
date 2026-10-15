import type { AnchorHTMLAttributes, ReactNode } from "react";
export default function Link({
  href,
  children,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}) {
  // Next.js-only navigation options have no effect in the static preview.
  void _prefetch;
  void _replace;
  void _scroll;
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}
