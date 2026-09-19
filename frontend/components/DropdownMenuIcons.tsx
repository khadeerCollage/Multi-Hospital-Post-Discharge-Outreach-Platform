'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogOutIcon,
  SettingsIcon,
  Shield,
  Users,
  Building2,
  LayoutDashboard,
  ChevronDown,
  AlertTriangle,
  PhoneCall,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function DropdownMenuIcons() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) {
        setUser(JSON.parse(u));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AD';

  const role = user?.role || 'platform_admin';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            className="flex items-center gap-2 border-gray-200 bg-white hover:bg-gray-50 h-9 px-2.5 shadow-2xs"
          >
            <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[10px] tracking-wide">
              {initials}
            </div>
            <div className="text-left hidden sm:block">
              <span className="text-xs font-semibold text-gray-800 block truncate max-w-[110px]">
                {user?.full_name?.split(' ')[0] || 'Admin'}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </Button>
        }
      />

      <DropdownMenuContent align="end" className="w-60 p-2">
        {/* Admin Profile Header */}
        <div className="px-2 py-2 mb-1 bg-gray-50/80 rounded-lg border border-gray-100">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              {initials}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-900 truncate">
                {user?.full_name || 'Administrator'}
              </p>
              <p className="text-[11px] text-gray-500 font-mono truncate">
                {user?.email || 'admin@platform.com'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-800 border border-blue-200 capitalize">
              {role.replace('_', ' ')}
            </span>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Admin Controls</DropdownMenuLabel>

        {/* Role-Specific Admin Actions */}
        {role === 'platform_admin' && (
          <>
            <DropdownMenuItem onClick={() => router.push('/admin')}>
              <LayoutDashboard />
              Platform Overview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/users')}>
              <Users />
              Staff & Users Directory
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/admin/hospitals')}>
              <Building2 />
              Hospital Network
            </DropdownMenuItem>
          </>
        )}

        {role === 'hospital_admin' && (
          <>
            <DropdownMenuItem onClick={() => router.push('/dashboard')}>
              <LayoutDashboard />
              Hospital Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <SettingsIcon />
              Hospital Telephony Settings
            </DropdownMenuItem>
          </>
        )}

        {role === 'clinical_reviewer' && (
          <>
            <DropdownMenuItem onClick={() => router.push('/escalations')}>
              <AlertTriangle />
              Clinical Escalations
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/patients')}>
              <Users />
              Patient Roster
            </DropdownMenuItem>
          </>
        )}

        {role === 'campaign_manager' && (
          <>
            <DropdownMenuItem onClick={() => router.push('/campaigns')}>
              <PhoneCall />
              Outreach Campaigns
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/queue')}>
              <LayoutDashboard />
              Live Queue Monitor
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
