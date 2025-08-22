import clsx from 'clsx';

type Props = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
};

export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  className,
}: Props) {
  return (
    <div className={clsx('w-full', align === 'center' && 'text-center', className)}>
      {eyebrow && (
        <div className="text-xs tracking-wide uppercase text-slate-500">{eyebrow}</div>
      )}
      {title && (
        <h2
          className="mt-1 text-3xl md:text-4xl"
          style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}
        >
          {title}
        </h2>
      )}
      {subtitle && (
        <p className="mt-2 text-slate-600">{subtitle}</p>
      )}
    </div>
  );
}
