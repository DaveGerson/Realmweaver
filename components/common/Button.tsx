
import React from 'react';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
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
  const baseClasses = 'inline-flex items-center justify-center rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors disabled:opacity-50 disabled:pointer-events-none';

  const variantClasses = {
    primary: 'bg-amber-600 text-white hover:bg-amber-500 focus:ring-amber-500',
    secondary: 'bg-slate-700 text-slate-100 hover:bg-slate-600 focus:ring-slate-500',
    ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100',
    danger: 'bg-red-800 text-white hover:bg-red-700 focus:ring-red-600',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const mergedClasses = twMerge(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    className
  );

  return (
    <button className={mergedClasses} {...props}>
      {children}
    </button>
  );
};
