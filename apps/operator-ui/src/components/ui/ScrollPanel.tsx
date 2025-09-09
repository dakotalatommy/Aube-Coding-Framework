import React from 'react';

type ScrollPanelProps = React.HTMLAttributes<HTMLDivElement> & {
  /**
   * Optional max height. Defaults to 100% of the parent minus nothing.
   * Pass CSS like `calc(100dvh - 160px)` to fit inside shells.
   */
  maxHeight?: string;
};

/**
 * ScrollPanel — a small helper that avoids overflow traps inside
 * 100dvh shells by providing an overflow:auto region with touch
 * momentum scrolling and sane min-height/overscroll behavior.
 *
 * Usage:
 *   <ScrollPanel className="rounded-xl border bg-white p-3" maxHeight="calc(100dvh - var(--bvx-commandbar-height,64px) - 220px)">
 *     ...content...
 *   </ScrollPanel>
 */
export default function ScrollPanel({ className, style, children, maxHeight, ...rest }: ScrollPanelProps) {
  const mergedStyle: React.CSSProperties = {
    ...(style || {}),
    ...(maxHeight ? { maxHeight } : {}),
  };
  return (
    <div className={`bvx-scroll-panel ${className || ''}`.trim()} style={mergedStyle} {...rest}>
      {children}
    </div>
  );
}

