
import React from 'react';
import { twMerge } from 'tailwind-merge';

// `ComponentPropsWithRef` (not `ButtonHTMLAttributes`) so callers can pass a
// `ref` — React 19 hands it to a function component as an ordinary prop, and
// the `...props` spread below puts it on the real <button>. Used to return
// focus to a control after an inline picker it opened closes.
interface ButtonProps extends React.ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors disabled:opacity-50 disabled:pointer-events-none';

  const variantClasses = {
    primary: 'rounded-md bg-amber-600 text-white hover:bg-amber-500 focus:ring-amber-500',
    secondary: 'rounded-md bg-slate-700 text-slate-100 hover:bg-slate-600 focus:ring-slate-500',
    ghost: 'rounded-md bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100',
    danger: 'rounded-md bg-red-800 text-white hover:bg-red-700 focus:ring-red-600',
    /** Toolbar-style icon-only button: transparent bg, circular, compact padding */
    icon: 'rounded-full bg-transparent text-slate-400 hover:bg-slate-700 hover:text-slate-100 focus:ring-slate-500',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  // Icon variant uses fixed padding regardless of size prop
  const iconSizeClass = 'p-2';

  const mergedClasses = twMerge(
    baseClasses,
    variantClasses[variant],
    variant === 'icon' ? iconSizeClass : sizeClasses[size],
    className
  );

  return (
    <button className={mergedClasses} {...props}>
      {children}
    </button>
  );
};
