import * as React from 'react';
import { cn } from '@/lib/utils';

const Empty = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex min-h-[280px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white/70 p-8 text-center animate-in fade-in-50',
      className
    )}
    {...props}
  />
));
Empty.displayName = 'Empty';

const EmptyHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex max-w-[420px] flex-col items-center gap-2', className)}
    {...props}
  />
));
EmptyHeader.displayName = 'EmptyHeader';

interface EmptyMediaProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'icon' | 'default';
}

const EmptyMedia = React.forwardRef<HTMLDivElement, EmptyMediaProps>(
  ({ className, variant = 'icon', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'mb-2 flex items-center justify-center',
        variant === 'icon' &&
          'h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 shadow-2xs border border-blue-100/80 [&>svg]:h-7 [&>svg]:w-7',
        className
      )}
      {...props}
    />
  )
);
EmptyMedia.displayName = 'EmptyMedia';

const EmptyTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-base font-bold text-gray-900 tracking-tight', className)}
    {...props}
  />
));
EmptyTitle.displayName = 'EmptyTitle';

const EmptyDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs text-gray-500 leading-relaxed', className)}
    {...props}
  />
));
EmptyDescription.displayName = 'EmptyDescription';

const EmptyContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('mt-5 flex flex-wrap items-center justify-center gap-2.5', className)}
    {...props}
  />
));
EmptyContent.displayName = 'EmptyContent';

export {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
};
