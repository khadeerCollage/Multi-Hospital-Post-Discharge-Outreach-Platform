'use client';
import { useState, useEffect } from 'react';
import { Activity, Users, FileText, AlertTriangle } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function HospitalDashboard() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([
      fetchApi('/api/v1/campaigns'),
      fetchApi('/api/v1/escalations'),
    ]).then(([campRes, escRes]) => {
      if (campRes.status === 'fulfilled') setCampaigns(campRes.value?.items || campRes.value || []);
      if (escRes.status === 'fulfilled') setEscalations(escRes.value?.items || escRes.value || []);
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading dashboard...</div>;

  const activeCampaigns = campaigns.filter((c: any) => c.status === 'RUNNING').length;
  const openEscalations = escalations.filter((e: any) => e.status === 'OPEN').length;

  return (
    <div className="p-8">
      {/* Branded CareReach Hospital Command Center Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl border border-teal-100 shadow-xs bg-white p-1 flex items-center justify-center flex-shrink-0">
            <img
              src="/logo.png"
              alt="CareReach"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Hospital Outreach Operations</h1>
              <span className="bg-teal-100 text-teal-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                CareReach™ Facility Node
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Live post-discharge patient engagement, campaign monitoring, and clinical escalation triage
            </p>
          </div>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Activity, label: 'Active Campaigns', value: activeCampaigns, color: 'text-blue-600 bg-blue-50' },
          { icon: FileText, label: 'Total Campaigns', value: campaigns.length, color: 'text-green-600 bg-green-50' },
          { icon: AlertTriangle, label: 'Open Escalations', value: openEscalations, color: 'text-red-600 bg-red-50' },
          { icon: Users, label: 'Total Escalations', value: escalations.length, color: 'text-purple-600 bg-purple-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${s.color}`}><s.icon className="h-5 w-5" /></div>
              <span className="text-sm text-gray-500">{s.label}</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Campaigns */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Recent Campaigns</h3>
            <Link href="/campaigns" className="text-blue-600 text-sm hover:text-blue-800">View All</Link>
          </div>
          <div className="divide-y">
            {campaigns.slice(0, 5).map((c: any) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="px-6 py-3 flex justify-between items-center hover:bg-gray-50">
                <span className="font-medium text-sm">{c.name}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${c.status === 'RUNNING' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{c.status}</span>
              </Link>
            ))}
            {campaigns.length === 0 && <p className="px-6 py-4 text-gray-400 text-sm">No campaigns yet.</p>}
          </div>
        </div>

        {/* Recent Escalations */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Recent Escalations</h3>
            <Link href="/escalations" className="text-blue-600 text-sm hover:text-blue-800">View All</Link>
          </div>
          <div className="divide-y">
            {escalations.slice(0, 5).map((e: any) => (
              <Link key={e.id} href={`/escalations/${e.id}`} className="px-6 py-3 flex justify-between items-center hover:bg-gray-50">
                <span className="font-medium text-sm">{e.trigger?.slice(0, 50)}</span>
                <span className={`px-2 py-1 text-xs rounded-full ${e.priority === 'critical' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}`}>{e.priority}</span>
              </Link>
            ))}
            {escalations.length === 0 && <p className="px-6 py-4 text-gray-400 text-sm">No escalations yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}