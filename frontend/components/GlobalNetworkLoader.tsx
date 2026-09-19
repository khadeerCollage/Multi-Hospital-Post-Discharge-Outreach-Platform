'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { subscribeToNetworkActivity } from '@/lib/api';

export function GlobalNetworkLoader() {
  const [activeCount, setActiveCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout | null = null;
    const unsubscribe = subscribeToNetworkActivity(count => {
      setActiveCount(count);
      if (count > 0) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        setVisible(true);
      } else {
        // Keep visible for 350ms to allow smooth completion animation and prevent flickering
        timeout = setTimeout(() => {
          setVisible(false);
        }, 350);
      }
    });

    return () => {
      unsubscribe();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* 1. Top Shimmer Clinical Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-[3px] z-[99999] overflow-hidden bg-blue-100/60 pointer-events-none">
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes network-shimmer {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(20%); }
              100% { transform: translateX(100%); }
            }
          `
        }} />
        <div
          className="h-full w-full bg-gradient-to-r from-blue-600 via-teal-400 to-indigo-600"
          style={{
            animation: 'network-shimmer 1.2s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
        />
      </div>

      {/* 2. Floating Clinical Syncing Indicator (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-[99999] pointer-events-none transition-all duration-300">
        <div className="flex items-center gap-2.5 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-xs font-semibold text-blue-900 shadow-xl backdrop-blur-md transition-all duration-200">
          {/* Live Pulse Indicator */}
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-600"></span>
          </span>

          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          <span>
            {activeCount > 1
              ? `Syncing (${activeCount} active requests)...`
              : 'Syncing with Hospital API...'}
          </span>
        </div>
      </div>
    </>
  );
}

