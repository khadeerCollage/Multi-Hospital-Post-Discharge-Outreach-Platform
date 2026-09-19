'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  Activity, 
  FileText, 
  AlertTriangle, 
  Settings as SettingsIcon, 
  LogOut,
  Cpu,
  ClipboardList,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { BreadcrumbsNav } from '@/components/BreadcrumbsNav';
import Loader from '@/components/ui/loader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const pathname = usePathname();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      window.location.href = '/login';
    } else {
      try {
        setUser(JSON.parse(userData));
      } catch {
        window.location.href = '/login';
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50/50">
        <Loader size="md" title="Synchronizing Clinical Session..." subtitle="Verifying hospital tenant authentication and permissions" />
      </div>
    );
  }

  const links = [
    ...(user.role === 'platform_admin' ? [
      { name: 'Admin Dashboard', href: '/admin', icon: LayoutDashboard },
      { name: 'Hospitals', href: '/admin/hospitals', icon: Building2 },
      { name: 'Staff & Users', href: '/users', icon: Users },
      { name: 'AI & Security', href: '/ai-usage', icon: ShieldCheck },
    ] : []),
    ...(user.role === 'hospital_admin' ? [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Patients', href: '/patients', icon: Users },
      { name: 'Campaigns', href: '/campaigns', icon: FileText },
      { name: 'Queue Monitor', href: '/queue', icon: Activity },
      { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
      { name: 'Protocols', href: '/protocols', icon: ClipboardList },
      { name: 'Settings', href: '/settings', icon: SettingsIcon },
    ] : []),
    ...(user.role === 'campaign_manager' ? [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Campaigns', href: '/campaigns', icon: FileText },
      { name: 'Queue Monitor', href: '/queue', icon: Activity },
      { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
    ] : []),
    ...(user.role === 'clinical_reviewer' ? [
      { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
      { name: 'Patients', href: '/patients', icon: Users },
    ] : [])
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 flex items-center space-x-3 border-b border-gray-800">
          <img
            src="/logo.png"
            alt="CareReach"
            className="h-10 w-10 rounded-xl object-contain bg-white p-0.5 shadow-md flex-shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-base leading-tight text-white tracking-tight flex items-center gap-1">
              CareReach<span className="text-teal-400 text-xs font-semibold">™</span>
            </span>
            <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase truncate">
              Hospital Outreach
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {links.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link 
                  key={link.name} 
                  href={link.href} 
                  className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <link.icon className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`} />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-800 bg-gray-950">
          <div className="text-sm font-medium text-white truncate">{user.full_name || user.email}</div>
          <div className="text-xs text-gray-400 capitalize mb-3">{user.role?.replace('_', ' ')}</div>
          <button 
            onClick={handleLogout} 
            className="group flex w-full items-center px-2 py-2 text-sm font-medium rounded-md text-red-400 hover:bg-gray-800 hover:text-red-300 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
            Logout
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <BreadcrumbsNav />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}