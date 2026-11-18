import { useEffect, useRef } from 'react';

interface Props {
  title: string;
  description?: string;
  /** Moves keyboard and screen reader focus to the heading when it mounts (after a navigation). */
  focusOnMount?: boolean;
}

/** The page heading block: the only `h1` of a page, with an optional one-line description. */
export function PageHeader({ title, description, focusOnMount = false }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount, title]);

  return (
    <header className="mb-6">
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold focus:outline-none">
        {title}
      </h1>
      {description ? <p className="mt-1 max-w-prose text-base-content/70">{description}</p> : null}
    </header>
  );
}
