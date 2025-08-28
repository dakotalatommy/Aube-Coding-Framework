import React from 'react';

type ButtonVariant = 'primary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const base = 'inline-flex items-center justify-center rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:opacity-60 disabled:cursor-not-allowed';
const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
};
const variants: Record<ButtonVariant, string> = {
  primary: 'text-white shadow hover:shadow-md bg-gradient-to-r from-pink-500 to-violet-500 hover:from-pink-600 hover:to-violet-600',
  outline: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 shadow-sm',
  ghost: 'bg-transparent text-slate-900 hover:bg-slate-50',
};

export default function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const classes = `${base} ${sizes[size]} ${variants[variant]} ${className}`.trim();
  return <button className={classes} {...props} />;
}


type ButtonLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function ButtonLink({ href, variant = 'primary', size = 'md', className = '', ...props }: ButtonLinkProps) {
  const classes = `${base} ${sizes[size]} ${variants[variant]} ${className}`.trim();
  return <a href={href} className={classes} {...props} />;
}


