'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg';
  progress?: number;
}

export default function Loader({
  title = 'Accessing clinical systems...',
  subtitle = 'Please wait while we synchronize hospital records and queues',
  size = 'md',
  progress,
  className,
  ...props
}: LoaderProps) {
  const sizeConfig = {
    sm: {
      logoWidth: 'w-20',
      barWidth: 'w-40 sm:w-44',
      barHeight: 'h-1.5',
      titleClass: 'text-xs font-semibold',
      subtitleClass: 'text-[11px]',
      gap: 'gap-4',
      spacing: 'space-y-1',
      maxWidth: 'max-w-xs',
    },
    md: {
      logoWidth: 'w-28 sm:w-32',
      barWidth: 'w-48 sm:w-56',
      barHeight: 'h-2',
      titleClass: 'text-sm font-semibold',
      subtitleClass: 'text-xs',
      gap: 'gap-5',
      spacing: 'space-y-1.5',
      maxWidth: 'max-w-sm',
    },
    lg: {
      logoWidth: 'w-36 sm:w-40',
      barWidth: 'w-56 sm:w-64',
      barHeight: 'h-2.5',
      titleClass: 'text-base font-semibold',
      subtitleClass: 'text-sm',
      gap: 'gap-6',
      spacing: 'space-y-2',
      maxWidth: 'max-w-md',
    },
  };

  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8',
        config.gap,
        className
      )}
      {...props}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes mac-boot-flow {
            0% {
              left: -35%;
              width: 35%;
            }
            50% {
              left: 25%;
              width: 55%;
            }
            100% {
              left: 100%;
              width: 30%;
            }
          }
          @keyframes logo-gentle-pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.92;
              transform: scale(0.99);
            }
          }
        `
      }} />

      {/* 1. CareReach Logo (Centered, Mac-boot style) */}
      <div 
        className="flex items-center justify-center"
        style={{ animation: 'logo-gentle-pulse 3s ease-in-out infinite' }}
      >
        <div className="p-2.5 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="CareReach"
            className={cn('h-auto object-contain', config.logoWidth)}
          />
        </div>
      </div>

      {/* 2. Apple Mac Boot-style Progress Loading Bar */}
      <div className={cn('relative rounded-full bg-slate-200/80 overflow-hidden shadow-inner', config.barWidth, config.barHeight)}>
        {typeof progress === 'number' ? (
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-700 via-teal-500 to-indigo-600 transition-all duration-300 shadow-xs"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        ) : (
          <div
            className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-blue-700 via-teal-400 to-indigo-600 shadow-xs"
            style={{
              animation: 'mac-boot-flow 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite',
            }}
          />
        )}
      </div>

      {/* 3. Refined Mac-style Clean Typography */}
      <div className={cn('text-center', config.spacing, config.maxWidth)}>
        <h3 className={cn(config.titleClass, 'text-slate-800 tracking-tight antialiased')}>
          {title}
        </h3>

        {subtitle && (
          <p className={cn(config.subtitleClass, 'text-slate-400 font-normal leading-relaxed antialiased')}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

export { Loader };

