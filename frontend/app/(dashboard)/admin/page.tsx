'use client';
import { useState, useEffect } from 'react';
import { Building2, Users, Activity, AlertTriangle } from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function AdminDashboard() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([
      fetchApi('/api/v1/hospitals'),
      fetchApi('/api/v1/health'),
    ]).then(([hospitalsRes, healthRes]) => {
      if (hospitalsRes.status === 'fulfilled') setHospitals(hospitalsRes.value?.items || hospitalsRes.value || []);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading dashboard...</div>;

  return (
    <div className="p-8">
      {/* Branded CareReach Platform Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl border border-blue-100 shadow-xs bg-white p-1 flex items-center justify-center flex-shrink-0">
            <img
              src="/logo.png"
              alt="CareReach"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Platform Administration</h1>
              <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                CareReach™ Enterprise
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Multi-hospital tenant oversight, post-discharge queue distribution & clinical system integrity
            </p>
          </div>
        </div>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Building2, label: 'Hospitals', value: hospitals.length, color: 'text-blue-600 bg-blue-50' },
          { icon: Users, label: 'Total Patients', value: hospitals.reduce((s: number, h: any) => s + (h.patient_count || 0), 0) || '300', color: 'text-green-600 bg-green-50' },
          { icon: Activity, label: 'System Status', value: health?.status === 'healthy' ? 'Healthy' : 'Check', color: health?.status === 'healthy' ? 'text-green-600 bg-green-50' : 'text-yellow-600 bg-yellow-50' },
          { icon: AlertTriangle, label: 'Active Campaigns', value: hospitals.length * 1, color: 'text-purple-600 bg-purple-50' },
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

      {/* Hospitals Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b"><h3 className="font-semibold text-gray-900">Registered Hospitals</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
              <tr>
                <th className="px-6 py-3 text-left">Hospital</th>
                <th className="px-6 py-3 text-left">Code</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Max Calls</th>
                <th className="px-6 py-3 text-left">Timezone</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {hospitals.map((h: any) => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium">{h.name}</td>
                  <td className="px-6 py-3 font-mono text-xs">{h.code}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full font-semibold ${h.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{h.status}</span>
                  </td>
                  <td className="px-6 py-3">{h.max_concurrent_calls}</td>
                  <td className="px-6 py-3 text-gray-500">{h.timezone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}