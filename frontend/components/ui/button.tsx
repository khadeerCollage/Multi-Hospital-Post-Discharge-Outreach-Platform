import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  nativeButton?: boolean;
  render?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', nativeButton = true, render, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50';

    const variants = {
      default: 'bg-blue-600 text-white shadow-xs hover:bg-blue-700',
      destructive: 'bg-red-600 text-white shadow-xs hover:bg-red-700',
      outline: 'border border-gray-300 bg-white shadow-2xs hover:bg-gray-50 text-gray-700',
      secondary: 'bg-gray-100 text-gray-900 shadow-2xs hover:bg-gray-200',
      ghost: 'hover:bg-gray-100 text-gray-700',
      link: 'text-blue-600 underline-offset-4 hover:underline',
    };

    const sizes = {
      default: 'h-9 px-4 py-2',
      sm: 'h-8 rounded-md px-3 text-xs',
      lg: 'h-10 rounded-md px-8',
      icon: 'h-9 w-9',
    };

    const combinedClasses = cn(baseStyles, variants[variant], sizes[size], className);

    if (render && React.isValidElement(render) && !nativeButton) {
      return React.cloneElement(render as React.ReactElement<any>, {
        className: cn(combinedClasses, (render as any).props.className),
        ...props,
      });
    }

    return (
      <button
        ref={ref}
        className={combinedClasses}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button };
