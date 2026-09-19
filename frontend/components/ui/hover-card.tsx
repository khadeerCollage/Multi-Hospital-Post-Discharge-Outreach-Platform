'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface HoverCardContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  delay: number;
  closeDelay: number;
}

const HoverCardContext = React.createContext<HoverCardContextType | undefined>(undefined);

export function HoverCard({
  children,
  openDelay = 150,
  closeDelay = 150,
}: {
  children: React.ReactNode;
  openDelay?: number;
  closeDelay?: number;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <HoverCardContext.Provider
      value={{ open, setOpen, delay: openDelay, closeDelay }}
    >
      <div className="relative inline-block">{children}</div>
    </HoverCardContext.Provider>
  );
}

export function HoverCardTrigger({
  children,
  render,
  className,
  delay: customDelay,
  closeDelay: customCloseDelay,
  ...props
}: {
  children?: React.ReactNode;
  render?: React.ReactNode;
  className?: string;
  delay?: number;
  closeDelay?: number;
} & React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(HoverCardContext);
  if (!context) throw new Error('HoverCardTrigger must be used within HoverCard');

  const enterTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const leaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const effectiveDelay = customDelay ?? context.delay;
  const effectiveCloseDelay = customCloseDelay ?? context.closeDelay;

  const handleMouseEnter = () => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current);
    enterTimeoutRef.current = setTimeout(() => {
      context.setOpen(true);
    }, effectiveDelay);
  };

  const handleMouseLeave = () => {
    if (enterTimeoutRef.current) clearTimeout(enterTimeoutRef.current);
    leaveTimeoutRef.current = setTimeout(() => {
      context.setOpen(false);
    }, effectiveCloseDelay);
  };

  if (render && React.isValidElement(render)) {
    return React.cloneElement(render as React.ReactElement<any>, {
      onMouseEnter: (e: React.MouseEvent) => {
        if ((render as any).props.onMouseEnter) (render as any).props.onMouseEnter(e);
        handleMouseEnter();
      },
      onMouseLeave: (e: React.MouseEvent) => {
        if ((render as any).props.onMouseLeave) (render as any).props.onMouseLeave(e);
        handleMouseLeave();
      },
    });
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn('inline-flex cursor-pointer', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function HoverCardContent({
  children,
  side = 'bottom',
  align = 'center',
  className,
  ...props
}: {
  children: React.ReactNode;
  side?: 'left' | 'top' | 'bottom' | 'right';
  align?: 'start' | 'center' | 'end';
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const context = React.useContext(HoverCardContext);
  if (!context) throw new Error('HoverCardContent must be used within HoverCard');

  if (!context.open) return null;

  const sideStyles = {
    top: 'bottom-full mb-2',
    bottom: 'top-full mt-2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  const alignStyles = {
    start: 'left-0',
    center: side === 'top' || side === 'bottom' ? 'left-1/2 -translate-x-1/2' : '',
    end: 'right-0',
  };

  return (
    <div
      onMouseEnter={() => context.setOpen(true)}
      onMouseLeave={() => context.setOpen(false)}
      className={cn(
        'absolute z-50 w-72 rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-xl outline-hidden animate-in fade-in-0 zoom-in-95 duration-150',
        sideStyles[side],
        alignStyles[align],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
