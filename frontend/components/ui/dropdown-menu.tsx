'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface DropdownContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownContext = React.createContext<DropdownContextType | undefined>(undefined);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  children,
  render,
  className,
  ...props
}: {
  children?: React.ReactNode;
  render?: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuTrigger must be inside DropdownMenu');

  if (render && React.isValidElement(render)) {
    return React.cloneElement(render as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        if ((render as any).props.onClick) (render as any).props.onClick(e);
        context.setOpen(!context.open);
      },
    });
  }

  return (
    <button
      type="button"
      onClick={() => context.setOpen(!context.open)}
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  children,
  align = 'end',
  className,
  ...props
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(DropdownContext);
  if (!context) throw new Error('DropdownMenuContent must be inside DropdownMenu');

  if (!context.open) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 min-w-[12rem] overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 text-gray-900 shadow-xl animate-in fade-in-80 slide-in-from-top-2 duration-150',
        align === 'end' ? 'right-0' : 'left-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({
  children,
  variant = 'default',
  className,
  onClick,
  ...props
}: {
  children: React.ReactNode;
  variant?: 'default' | 'destructive';
  className?: string;
  onClick?: () => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(DropdownContext);

  const handleClick = () => {
    if (onClick) onClick();
    if (context) context.setOpen(false);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium outline-hidden transition-colors',
        variant === 'destructive'
          ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
        '[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn('-mx-1.5 my-1.5 h-px bg-gray-100', className)} />;
}

export function DropdownMenuLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400', className)}>
      {children}
    </div>
  );
}
