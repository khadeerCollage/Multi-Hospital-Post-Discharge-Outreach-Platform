'use client';
import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { DropdownMenuIcons } from '@/components/DropdownMenuIcons';
import { HospitalNavigationMenu } from '@/components/HospitalNavigationMenu';
import { CreateMenu } from '@/components/CreateMenu';

const routeLabels: Record<string, string> = {
  admin: 'Platform Admin',
  hospitals: 'Hospitals',
  users: 'Staff & Users',
  dashboard: 'Hospital Overview',
  patients: 'Patient Directory',
  campaigns: 'Outreach Campaigns',
  queue: 'Live Call Queue',
  escalations: 'Clinical Escalations',
  protocols: 'Outreach Protocols',
  settings: 'Configuration',
  'ai-usage': 'AI & Security',
};

export function BreadcrumbsNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const parsed = JSON.parse(u);
        setRole(parsed.role || '');
      }
    } catch {
      // ignore
    }
  }, []);

  if (!pathname || pathname === '/login') return null;

  const segments = pathname.split('/').filter(Boolean);
  const homeHref = role === 'platform_admin' ? '/admin' : '/dashboard';

  return (
    <div className="bg-white border-b border-gray-200 px-8 py-3 flex items-center justify-between shadow-2xs">
      <Breadcrumb>
        <BreadcrumbList>
          {/* Home Link */}
          <BreadcrumbItem>
            <BreadcrumbLink href={homeHref} className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600">
              <Home className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                {role === 'platform_admin' ? 'Platform' : 'Hospital'}
              </span>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {segments.map((segment, index) => {
            const href = '/' + segments.slice(0, index + 1).join('/');
            const isLast = index === segments.length - 1;

            // Determine friendly label
            let label = routeLabels[segment.toLowerCase()] || segment;
            
            // Check if it's a UUID/ID
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
            if (isUUID) {
              const prevSegment = segments[index - 1];
              if (prevSegment === 'patients') label = 'Patient Record';
              else if (prevSegment === 'campaigns') label = 'Live Queue Monitor';
              else if (prevSegment === 'escalations') label = 'Clinical Case Review';
              else label = `Record (${segment.slice(0, 8)}...)`;
            }

            return (
              <React.Fragment key={href}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="text-xs font-semibold uppercase tracking-wider text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                      {label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={href} className="text-xs font-medium text-gray-500 hover:text-blue-600">
                      {label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="flex items-center gap-3">
        <CreateMenu corner={28} />
        <div className="h-4 w-px bg-gray-200 hidden sm:block" />
        <HospitalNavigationMenu />
        <div className="h-4 w-px bg-gray-200 hidden lg:block" />
        <DropdownMenuIcons />
      </div>
    </div>
  );
}
