import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:scale-100 cursor-pointer';

  const sizeStyles = {
    sm: 'h-9 px-4 text-xs tracking-wide',
    md: 'h-11 px-5 text-sm',
    lg: 'h-12 px-7 text-base font-semibold',
  };

  const variantStyles = {
    primary:
      'bg-fintech-primary text-white hover:bg-[#005bb5] focus:ring-fintech-primary shadow-sm hover:shadow dark:bg-blue-600 dark:hover:bg-blue-500',
    secondary:
      'bg-blue-100 dark:bg-blue-950/70 text-fintech-primary dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900 focus:ring-fintech-primary border border-blue-200 dark:border-blue-800',
    outline:
      'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-fintech-primary',
    danger:
      'bg-fintech-error text-white hover:bg-[#b82418] focus:ring-fintech-error dark:bg-red-600 dark:hover:bg-red-500',
    ghost:
      'bg-transparent text-slate-600 dark:text-slate-300 hover:text-fintech-navy dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-400',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin text-current" />
      ) : icon ? (
        <span className="mr-2 inline-flex items-center">{icon}</span>
      ) : null}
      {children}
    </button>
  );
};
