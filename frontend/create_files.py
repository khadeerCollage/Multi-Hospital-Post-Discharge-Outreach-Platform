import os
import json

base_dir = r"c:\Users\USER\Desktop\Multi-Hospital-Post-Discharge-Outreach-Platform\frontend"
os.makedirs(base_dir, exist_ok=True)

files = {}

files["package.json"] = """{
  "name": "mhpdop-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.15",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "lucide-react": "^0.447.0",
    "recharts": "^2.13.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.6.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}"""

files["tsconfig.json"] = """{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}"""

files["next.config.mjs"] = """const nextConfig = {
  output: 'standalone',
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000' }
};
export default nextConfig;"""

files["tailwind.config.ts"] = """import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config"""

files["postcss.config.js"] = """module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}"""

files[".env.local"] = """NEXT_PUBLIC_API_URL=http://localhost:8000"""

files["app/globals.css"] = """@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50 text-gray-900;
}"""

files["lib/api.ts"] = """const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}"""

files["app/layout.tsx"] = """import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MHPDOP',
  description: 'Multi-Hospital Post-Discharge Outreach Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}"""

files["app/login/page.tsx"] = """'use client';
import { useState } from 'react';
import { Building2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Mock login since we don't have backend
      const mockUser = {
        id: '1', email, full_name: 'Test User', role: email.split('@')[0], tenant_id: 't1'
      };
      
      localStorage.setItem('token', 'mock_token');
      localStorage.setItem('user', JSON.stringify(mockUser));
      
      if (mockUser.role === 'platform_admin') window.location.href = '/admin';
      else if (mockUser.role === 'hospital_admin') window.location.href = '/dashboard';
      else if (mockUser.role === 'campaign_manager') window.location.href = '/campaigns';
      else if (mockUser.role === 'clinical_reviewer') window.location.href = '/escalations';
      else window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
        <div className="flex flex-col items-center">
          <Building2 className="h-12 w-12 text-blue-600 mb-2" />
          <h2 className="mt-6 text-center text-2xl font-extrabold text-gray-900">
            Multi-Hospital Post-Discharge Outreach Platform
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && <div className="text-red-500 text-sm text-center">{error}</div>}
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                type="email" required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password" required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div>
            <button
              type="submit" disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
        <div className="text-xs text-gray-500 text-center mt-4">
          Demo roles (use as email prefix): platform_admin, hospital_admin, campaign_manager, clinical_reviewer
        </div>
      </div>
    </div>
  );
}"""

files["app/(dashboard)/layout.tsx"] = """'use client';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Building2, Users, Activity, FileText, AlertTriangle, Heart, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      window.location.href = '/login';
    } else {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const links = [
    ...(user.role === 'platform_admin' ? [
      { name: 'Admin Dashboard', href: '/admin', icon: LayoutDashboard },
      { name: 'Hospitals', href: '/admin/hospitals', icon: Building2 },
      { name: 'System Health', href: '/health', icon: Activity },
    ] : []),
    ...(user.role === 'hospital_admin' ? [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Patients', href: '/patients', icon: Users },
      { name: 'Campaigns', href: '/campaigns', icon: FileText },
      { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
    ] : []),
    ...(user.role === 'campaign_manager' ? [
      { name: 'Campaigns', href: '/campaigns', icon: FileText },
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
        <div className="p-4 flex items-center space-x-2 border-b border-gray-800">
          <Heart className="h-6 w-6 text-blue-500" />
          <span className="font-bold text-lg">MHPDOP</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {links.map((link) => (
              <Link key={link.name} href={link.href} className="group flex items-center px-2 py-2 text-sm font-medium rounded-md hover:bg-gray-800 hover:text-white">
                <link.icon className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 group-hover:text-gray-300" />
                {link.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-gray-800">
          <div className="text-sm font-medium mb-4 px-2">{user.full_name || user.email}</div>
          <button onClick={handleLogout} className="group flex w-full items-center px-2 py-2 text-sm font-medium rounded-md text-red-400 hover:bg-gray-800 hover:text-red-300">
            <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
            Logout
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex flex-col">
        {children}
      </div>
    </div>
  );
}"""

files["app/(dashboard)/admin/page.tsx"] = """'use client';
import { useState, useEffect } from 'react';
import { Building2, Users, Activity, FileText } from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function PlatformAdmin() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock data fetch
    setTimeout(() => {
      setData({
        stats: { hospitals: 12, patients: 45000, campaigns: 34, status: 'Healthy' },
        hospitals: [
          { id: 1, name: 'General Hospital', status: 'Active', patients: 12000, campaigns: 8 },
          { id: 2, name: 'City Medical Center', status: 'Active', patients: 8500, campaigns: 5 },
        ]
      });
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Platform Administration</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center"><Building2 className="text-blue-500 mr-2"/><h3 className="text-gray-500 font-medium">Hospitals</h3></div>
          <p className="text-3xl font-bold mt-2">{data.stats.hospitals}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center"><Users className="text-green-500 mr-2"/><h3 className="text-gray-500 font-medium">Total Patients</h3></div>
          <p className="text-3xl font-bold mt-2">{data.stats.patients}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center"><FileText className="text-purple-500 mr-2"/><h3 className="text-gray-500 font-medium">Active Campaigns</h3></div>
          <p className="text-3xl font-bold mt-2">{data.stats.campaigns}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center"><Activity className="text-red-500 mr-2"/><h3 className="text-gray-500 font-medium">System Status</h3></div>
          <p className="text-xl font-bold mt-2 text-green-600">{data.stats.status}</p>
        </div>
      </div>
      <h2 className="text-xl font-bold mb-4">Hospitals</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patients</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaigns</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.hospitals.map((h: any) => (
              <tr key={h.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{h.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">{h.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{h.patients}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{h.campaigns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}"""

files["app/(dashboard)/dashboard/page.tsx"] = """'use client';
import { useState, useEffect } from 'react';
import { Activity, Users, Phone, AlertTriangle } from 'lucide-react';

export default function HospitalDashboard() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setTimeout(() => {
      setData({
        stats: { campaigns: 5, patients: 1250, contactRate: '68%', escalations: 12 },
        recentCampaigns: [
          { id: 1, name: 'Cardiology Follow-up', status: 'RUNNING', progress: '45%' },
          { id: 2, name: 'Orthopedic Post-Op', status: 'COMPLETED', progress: '100%' },
        ],
        recentEscalations: [
          { id: 1, patient: 'John Doe', priority: 'HIGH', trigger: 'Severe Pain' },
        ]
      });
    }, 800);
  }, []);

  if (!data) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Hospital Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center"><Activity className="text-blue-500 mr-2"/><h3 className="text-gray-500 font-medium">Active Campaigns</h3></div>
          <p className="text-3xl font-bold mt-2">{data.stats.campaigns}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center"><Users className="text-green-500 mr-2"/><h3 className="text-gray-500 font-medium">Patients Enrolled</h3></div>
          <p className="text-3xl font-bold mt-2">{data.stats.patients}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center"><Phone className="text-purple-500 mr-2"/><h3 className="text-gray-500 font-medium">Contact Rate</h3></div>
          <p className="text-3xl font-bold mt-2">{data.stats.contactRate}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center"><AlertTriangle className="text-red-500 mr-2"/><h3 className="text-gray-500 font-medium">Open Escalations</h3></div>
          <p className="text-3xl font-bold mt-2 text-red-600">{data.stats.escalations}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold mb-4">Recent Campaigns</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {data.recentCampaigns.map((c: any) => (
              <div key={c.id} className="p-4 border-b last:border-0 flex justify-between items-center">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-gray-500">{c.progress} Completed</div>
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{c.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold mb-4">Recent Escalations</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {data.recentEscalations.map((e: any) => (
              <div key={e.id} className="p-4 border-b last:border-0 flex justify-between items-center">
                <div>
                  <div className="font-medium">{e.patient}</div>
                  <div className="text-sm text-gray-500">{e.trigger}</div>
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">{e.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}"""

files["app/(dashboard)/campaigns/page.tsx"] = """'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setCampaigns([
        { id: '1', name: 'Cardiology Q3', status: 'RUNNING', eligible: 450, progress: '45%' },
        { id: '2', name: 'Orthopedic Discharge', status: 'READY', eligible: 120, progress: '0%' },
        { id: '3', name: 'Diabetes Follow-up', status: 'DRAFT', eligible: 800, progress: '0%' }
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      READY: 'bg-blue-100 text-blue-800',
      RUNNING: 'bg-green-100 text-green-800 animate-pulse',
      PAUSED: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-emerald-100 text-emerald-800',
      CANCELLED: 'bg-red-100 text-red-800'
    };
    return `px-3 py-1 text-xs font-semibold rounded-full ${map[status] || 'bg-gray-100'}`;
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Create Campaign</button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eligible Patients</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/campaigns/${c.id}`} className="text-blue-600 hover:underline font-medium">{c.name}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap"><span className={getStatusBadge(c.status)}>{c.status}</span></td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{c.eligible}</td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{c.progress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4">Create Campaign</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input type="text" className="w-full border border-gray-300 rounded-md p-2" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea className="w-full border border-gray-300 rounded-md p-2" rows={3}></textarea>
            </div>
            <div className="flex justify-end space-x-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">Cancel</button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}"""

files["app/(dashboard)/campaigns/[id]/page.tsx"] = """'use client';
import { useState, useEffect } from 'react';
import { Play, Pause, Square, FileText } from 'lucide-react';

export default function CampaignDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);

  const fetchCampaign = () => {
    // Mock fetch
    setData({
      id: params.id,
      name: 'Cardiology Q3 Follow-up',
      status: 'RUNNING',
      queue: {
        active: 45, max: 100,
        pending: 120, calling: 8, retrying: 5, completed: 340, escalated: 12, manual: 4
      },
      tasks: [
        { id: 1, patient: 'Alice Smith', risk: 'critical', status: 'Calling', priority: 95, attempts: 1 },
        { id: 2, patient: 'Bob Jones', risk: 'high', status: 'Pending', priority: 80, attempts: 0 },
        { id: 3, patient: 'Charlie Brown', risk: 'moderate', status: 'Retrying', priority: 50, attempts: 2 }
      ]
    });
  };

  useEffect(() => {
    fetchCampaign();
    const interval = setInterval(fetchCampaign, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <div className="p-8">Loading...</div>;

  const handleAction = (action: string) => {
    console.log('Action:', action);
    // In real app, make API call to /api/v1/campaigns/{id}/{action}
  };

  const getRiskColor = (risk: string) => {
    const m: any = { critical: 'bg-red-500', high: 'bg-orange-500', moderate: 'bg-yellow-500', low: 'bg-green-500', routine: 'bg-gray-400' };
    return m[risk] || 'bg-gray-400';
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            {data.name}
            <span className="ml-4 px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 animate-pulse">{data.status}</span>
          </h1>
        </div>
        <div className="space-x-3">
          {data.status === 'DRAFT' && <button onClick={() => handleAction('prepare')} className="btn-primary">Prepare Campaign</button>}
          {(data.status === 'READY' || data.status === 'PAUSED') && <button onClick={() => handleAction('start')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"><Play className="w-4 h-4 mr-2"/> Start</button>}
          {data.status === 'RUNNING' && <button onClick={() => handleAction('pause')} className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center"><Pause className="w-4 h-4 mr-2"/> Pause</button>}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h2 className="text-lg font-bold mb-2">Queue Capacity</h2>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
          <div className="bg-blue-500 h-4 rounded-full transition-all duration-500" style={{ width: `${(data.queue.active / data.queue.max) * 100}%` }}></div>
        </div>
        <p className="text-sm text-gray-600 font-medium">{data.queue.active} / {data.queue.max} active calls</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <div className="bg-gray-100 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-gray-800">{data.queue.pending}</div><div className="text-sm text-gray-500">Pending</div></div>
        <div className="bg-blue-100 p-4 rounded-lg text-center animate-pulse"><div className="text-2xl font-bold text-blue-800">{data.queue.calling}</div><div className="text-sm text-blue-600">Calling</div></div>
        <div className="bg-yellow-100 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-yellow-800">{data.queue.retrying}</div><div className="text-sm text-yellow-600">Retrying</div></div>
        <div className="bg-green-100 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-green-800">{data.queue.completed}</div><div className="text-sm text-green-600">Completed</div></div>
        <div className="bg-red-100 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-red-800">{data.queue.escalated}</div><div className="text-sm text-red-600">Escalated</div></div>
        <div className="bg-orange-100 p-4 rounded-lg text-center"><div className="text-2xl font-bold text-orange-800">{data.queue.manual}</div><div className="text-sm text-orange-600">Manual</div></div>
      </div>

      <h2 className="text-xl font-bold mb-4">Active Tasks</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Attempts</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.tasks.map((t: any) => (
              <tr key={t.id}>
                <td className="px-6 py-4 whitespace-nowrap font-medium">{t.patient}</td>
                <td className="px-6 py-4 whitespace-nowrap flex items-center mt-2">
                  <div className={`w-3 h-3 rounded-full mr-2 ${getRiskColor(t.risk)}`}></div>
                  {t.risk}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{t.priority}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}"""

files["app/(dashboard)/escalations/page.tsx"] = """'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Escalations() {
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setEscalations([
        { id: '1', patient: 'Sarah Connor', priority: 'CRITICAL', status: 'OPEN', trigger: 'Reported severe chest pain', created: '2 mins ago' },
        { id: '2', patient: 'John Smith', priority: 'HIGH', status: 'OPEN', trigger: 'Missed 3 doses of medication', created: '1 hour ago' },
        { id: '3', patient: 'Mary Jane', priority: 'MODERATE', status: 'RESOLVED', trigger: 'Questions about appointment', created: '1 day ago' },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  const getPriorityColor = (p: string) => {
    const map: any = { CRITICAL: 'bg-red-100 text-red-800', HIGH: 'bg-orange-100 text-orange-800', MODERATE: 'bg-yellow-100 text-yellow-800' };
    return map[p] || 'bg-gray-100';
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Escalations</h1>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trigger</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {escalations.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/escalations/${e.id}`} className="text-blue-600 hover:underline font-medium">{e.patient}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap"><span className={`px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(e.priority)}`}>{e.priority}</span></td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{e.status}</td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-md truncate">{e.trigger}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{e.created}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}"""

files["app/(dashboard)/escalations/[id]/page.tsx"] = """'use client';
import { useState, useEffect } from 'react';

export default function EscalationDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    setTimeout(() => {
      setData({
        patient: { name: 'Sarah Connor', dob: '1980-05-12', mrn: 'MRN-12345', phone: '555-0199' },
        status: 'OPEN',
        triage: { decision: 'ESCALATE', consensus: '3/3 yes', arbiter: 'AI-Arbiter confirmed' },
        votes: [
          { assessor: 'Clinical-AI-1', escalate: true, confidence: 98, reasoning: 'Patient mentioned severe chest pain which is a red flag post-op.' },
          { assessor: 'Safety-AI-2', escalate: true, confidence: 95, reasoning: 'Symptom severity warrants immediate clinical review.' },
          { assessor: 'Context-AI-3', escalate: true, confidence: 90, reasoning: 'Given history of heart disease, chest pain must be escalated.' }
        ],
        transcript: [
          { sender: 'AI', text: 'Hello Sarah, how are you feeling today after your discharge?' },
          { sender: 'Patient', text: 'Not great. I have been having severe chest pain since this morning.' },
          { sender: 'AI', text: 'I understand. I am escalating your case to a nurse immediately. Please call 911 if it is an emergency.' }
        ]
      });
    }, 800);
  }, []);

  if (!data) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Escalation Review</h1>
        <span className="px-4 py-2 bg-red-100 text-red-800 rounded-md font-bold text-sm">STATUS: {data.status}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4">Patient Info</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">Name:</span> <span className="font-medium">{data.patient.name}</span></p>
            <p><span className="text-gray-500">MRN:</span> {data.patient.mrn}</p>
            <p><span className="text-gray-500">Phone:</span> {data.patient.phone}</p>
            <p><span className="text-gray-500">DOB:</span> {data.patient.dob}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 md:col-span-2">
          <h2 className="text-lg font-bold mb-4">Triage Result</h2>
          <div className="flex items-center mb-4">
            <span className="px-3 py-1 bg-red-600 text-white rounded-full text-sm font-bold mr-3">{data.triage.decision}</span>
            <span className="text-gray-600 font-medium">{data.triage.consensus}</span>
          </div>
          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">{data.triage.arbiter}</p>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">AI Assessments</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {data.votes.map((v: any, i: number) => (
          <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="font-bold text-gray-800 mb-2">{v.assessor}</div>
            <div className="flex justify-between text-sm mb-2">
              <span className={v.escalate ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{v.escalate ? 'ESCALATE' : 'SAFE'}</span>
              <span className="text-gray-500">{v.confidence}% confidence</span>
            </div>
            <p className="text-sm text-gray-600 italic">"{v.reasoning}"</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-bold mb-4">Conversation Transcript</h2>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 h-96 overflow-y-auto flex flex-col space-y-4">
            {data.transcript.map((msg: any, i: number) => (
              <div key={i} className={`flex ${msg.sender === 'AI' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.sender === 'AI' ? 'bg-blue-100 text-blue-900 rounded-bl-none' : 'bg-gray-100 text-gray-900 rounded-br-none'}`}>
                  <div className="font-bold text-xs mb-1 opacity-50">{msg.sender}</div>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-bold mb-4">Resolution</h2>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Notes</label>
            <textarea 
              className="w-full border border-gray-300 rounded-md p-3 mb-4 focus:ring-blue-500 focus:border-blue-500" 
              rows={6}
              placeholder="Enter actions taken..."
              value={resolution} onChange={(e) => setResolution(e.target.value)}
            ></textarea>
            <button className="w-full py-2 bg-blue-600 text-white font-bold rounded-md hover:bg-blue-700">Mark as Resolved</button>
          </div>
        </div>
      </div>
    </div>
  );
}"""

files["app/(dashboard)/patients/page.tsx"] = """'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Patients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTimeout(() => {
      setPatients([
        { id: '1', name: 'Alice Smith', mrn: 'MRN-101', risk: 'HIGH', phone: '555-0101', status: 'Enrolled' },
        { id: '2', name: 'Bob Jones', mrn: 'MRN-102', risk: 'MODERATE', phone: '555-0102', status: 'Discharged' },
        { id: '3', name: 'Charlie Brown', mrn: 'MRN-103', risk: 'LOW', phone: '555-0103', status: 'Enrolled' },
      ]);
      setLoading(false);
    }, 800);
  }, []);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Patients</h1>
        <input type="text" placeholder="Search patients..." className="border border-gray-300 rounded-md p-2 w-64" />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRN</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Risk Level</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {patients.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link href={`/patients/${p.id}`} className="text-blue-600 hover:underline font-medium">{p.name}</Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.mrn}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">{p.risk}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.phone}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex justify-between mt-4">
        <button className="px-4 py-2 border rounded text-gray-600 disabled:opacity-50" disabled>Previous</button>
        <button className="px-4 py-2 border rounded text-gray-600">Next</button>
      </div>
    </div>
  );
}"""

files["app/(dashboard)/patients/[id]/page.tsx"] = """'use client';
import { useState, useEffect } from 'react';

export default function PatientDetail({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setTimeout(() => {
      setData({
        name: 'Alice Smith', mrn: 'MRN-101', dob: '1975-10-22', phone: '555-0101', risk: 'HIGH',
        timeline: [
          { date: '2023-10-15', event: 'Discharged from Cardiology' },
          { date: '2023-10-16', event: 'Enrolled in Post-Op Campaign' },
          { date: '2023-10-17', event: 'Successful automated follow-up call' }
        ]
      });
    }, 800);
  }, []);

  if (!data) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Patient Profile</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-bold">{data.name}</h2>
          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full font-bold text-xs">{data.risk} RISK</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500 block">MRN</span><span className="font-medium">{data.mrn}</span></div>
          <div><span className="text-gray-500 block">DOB</span><span className="font-medium">{data.dob}</span></div>
          <div><span className="text-gray-500 block">Phone</span><span className="font-medium">{data.phone}</span></div>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Outreach Timeline</h2>
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="space-y-6">
          {data.timeline.map((item: any, i: number) => (
            <div key={i} className="flex relative">
              <div className="absolute top-0 bottom-0 left-2 w-0.5 bg-gray-200"></div>
              <div className="relative z-10 w-4 h-4 rounded-full bg-blue-500 mt-1 mr-4"></div>
              <div>
                <div className="text-xs text-gray-500 mb-1">{item.date}</div>
                <div className="text-sm font-medium">{item.event}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}"""

files["app/(dashboard)/health/page.tsx"] = """'use client';
import { useState, useEffect } from 'react';

export default function Health() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    setTimeout(() => {
      setHealth({
        components: [
          { name: 'Database (PostgreSQL)', status: 'operational' },
          { name: 'Cache (Redis)', status: 'operational' },
          { name: 'AI Provider (OpenAI)', status: 'operational' },
          { name: 'Queue (Celery)', status: 'operational' },
        ],
        queueMetrics: {
          pending: 120, processing: 15, failed: 2, total_processed: 45000
        }
      });
    }, 800);
  }, []);

  if (!health) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">System Health</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4">Component Status</h2>
          <div className="space-y-4">
            {health.components.map((c: any, i: number) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-medium">{c.name}</span>
                <span className="flex items-center text-sm">
                  <div className={`w-3 h-3 rounded-full mr-2 ${c.status === 'operational' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  {c.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4">Queue Metrics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded"><div className="text-2xl font-bold">{health.queueMetrics.pending}</div><div className="text-sm text-gray-500">Pending Tasks</div></div>
            <div className="p-4 bg-gray-50 rounded"><div className="text-2xl font-bold text-blue-600">{health.queueMetrics.processing}</div><div className="text-sm text-gray-500">Processing</div></div>
            <div className="p-4 bg-gray-50 rounded"><div className="text-2xl font-bold text-red-600">{health.queueMetrics.failed}</div><div className="text-sm text-gray-500">Failed (24h)</div></div>
            <div className="p-4 bg-gray-50 rounded"><div className="text-2xl font-bold text-green-600">{health.queueMetrics.total_processed}</div><div className="text-sm text-gray-500">Total Processed</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}"""

script = f"""import os

base_dir = r"{base_dir}"
files = {json.dumps(files)}

for filepath, content in files.items():
    full_path = os.path.join(base_dir, filepath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
"""

print(script)
