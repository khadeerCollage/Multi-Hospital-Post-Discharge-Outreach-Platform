'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  ExternalLink,
} from 'lucide-react';

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';

const clinicalComponents: { title: string; href: string; description: string }[] = [
  {
    title: 'Outreach Cohorts',
    href: '/campaigns',
    description: 'Post-discharge campaign batches, schedule windows, and patient enrollments.',
  },
  {
    title: 'Live Call Queue',
    href: '/queue',
    description: 'High-concurrency PostgreSQL dispatch engine with automatic worker recovery.',
  },
  {
    title: 'Patient Roster',
    href: '/patients',
    description: 'Discharged patient records, medical history, and clinical risk classifications.',
  },
  {
    title: 'Clinical Protocols',
    href: '/protocols',
    description: 'Hospital-approved symptom questionnaires and red-flag escalation thresholds.',
  },
  {
    title: 'AI & Clinical Security',
    href: '/ai-usage',
    description: 'Multi-agent consensus verification, conservative safety defaults, and tenant isolation.',
  },
];

export function HospitalNavigationMenu() {
  return (
    <NavigationMenu className="hidden lg:flex">
      <NavigationMenuList>
        {/* Getting Started Dropdown */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Clinical Operations</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="w-80 space-y-1">
              <ListItem href="/dashboard" title="Hospital Overview">
                Real-time operational summary, active call slots, and response metrics.
              </ListItem>
              <ListItem href="/campaigns" title="Outreach Campaigns">
                Manage automated telephone follow-ups for recently discharged patients.
              </ListItem>
              <ListItem href="/protocols" title="Triage Protocols">
                Red-flag clinical symptoms and immediate physician escalation triggers.
              </ListItem>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* Components 2-Column Grid */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Modules & Safety</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[480px] gap-2 md:grid-cols-2 p-1">
              {clinicalComponents.map((component) => (
                <ListItem
                  key={component.title}
                  title={component.title}
                  href={component.href}
                >
                  {component.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* With Icon Status Dropdown */}
        <NavigationMenuItem>
          <NavigationMenuTrigger>Queue Status</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="w-56 space-y-1 p-1">
              <li>
                <NavigationMenuLink
                  render={
                    <Link href="/escalations" className="flex items-center gap-2 text-xs font-semibold text-red-600 hover:bg-red-50">
                      <CircleAlertIcon className="h-4 w-4 text-red-500" />
                      <span>Open Escalations</span>
                    </Link>
                  }
                />
              </li>
              <li>
                <NavigationMenuLink
                  render={
                    <Link href="/queue" className="flex items-center gap-2 text-xs font-semibold text-amber-600 hover:bg-amber-50">
                      <CircleDashedIcon className="h-4 w-4 text-amber-500" />
                      <span>Pending & Retrying</span>
                    </Link>
                  }
                />
              </li>
              <li>
                <NavigationMenuLink
                  render={
                    <Link href="/campaigns" className="flex items-center gap-2 text-xs font-semibold text-green-600 hover:bg-green-50">
                      <CircleCheckIcon className="h-4 w-4 text-green-500" />
                      <span>Completed Outreach</span>
                    </Link>
                  }
                />
              </li>
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>

        {/* API Docs Direct Link */}
        <NavigationMenuItem>
          <NavigationMenuLink
            className={navigationMenuTriggerStyle()}
            render={
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs"
              >
                <span>Swagger API</span>
                <ExternalLink className="h-3 w-3 text-gray-400" />
              </a>
            }
          />
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function ListItem({
  title,
  children,
  href,
  ...props
}: React.ComponentPropsWithoutRef<'li'> & { href: string; title: string }) {
  return (
    <li {...props}>
      <NavigationMenuLink
        render={
          <Link href={href} className="group">
            <div className="flex flex-col gap-1 text-xs">
              <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {title}
              </div>
              <div className="line-clamp-2 text-gray-500 text-[11px] leading-relaxed">
                {children}
              </div>
            </div>
          </Link>
        }
      />
    </li>
  );
}

// Export the demo version with exact structure if needed
export { HospitalNavigationMenu as NavigationMenuDemo };
