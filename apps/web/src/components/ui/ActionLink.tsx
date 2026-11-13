import type { ReactNode } from 'react';

export function ActionLink({
  href,
  children,
  quiet = false,
}: {
  href: string;
  children: ReactNode;
  quiet?: boolean;
}) {
  return (
    <a
      className={`action-link${quiet ? ' action-link-quiet' : ''}`}
      href={href}
    >
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
