'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Activity, 
  Settings, 
  PhoneCall, 
  AlertTriangle, 
  LogOut,
  ClipboardList
} from 'lucide-react';

export function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const getLinks = () => {
    switch (user.role) {
      case 'platform_admin':
        return [
          { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
          { name: 'Hospitals', href: '/hospitals', icon: Building2 },
          { name: 'Users', href: '/users', icon: Users },
          { name: 'AI Usage', href: '/ai-usage', icon: Activity },
        ];
      case 'hospital_admin':
        return [
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          { name: 'Patients', href: '/patients', icon: Users },
          { name: 'Campaigns', href: '/campaigns', icon: PhoneCall },
          { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
          { name: 'Protocols', href: '/protocols', icon: ClipboardList },
          { name: 'Settings', href: '/settings', icon: Settings },
        ];
      case 'campaign_manager':
        return [
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
          { name: 'Campaigns', href: '/campaigns', icon: PhoneCall },
          { name: 'Queue Monitor', href: '/queue', icon: Activity },
          { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
        ];
      case 'clinical_reviewer':
        return [
          { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
          { name: 'Patients', href: '/patients', icon: Users },
        ];
      default:
        return [];
    }
  };

  const links = getLinks();

  return (
    <div className="flex flex-col w-64 h-screen bg-gray-900 text-white">
      <div className="flex items-center h-16 px-4 bg-gray-950">
        <Activity className="text-blue-500 mr-2" />
        <span className="font-bold text-sm truncate">MHP Outreach</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname.startsWith(link.href);
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  isActive ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className={`mr-3 flex-shrink-0 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`} />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 bg-gray-950 border-t border-gray-800">
        <div className="flex items-center mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{user.role.replace('_', ' ')}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center w-full px-2 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 hover:text-white"
        >
          <LogOut className="mr-3 h-5 w-5 text-gray-400" />
          Logout
        </button>
      </div>
    </div>
  );
}
