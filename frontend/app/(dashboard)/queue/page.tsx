'use client';
import { useState, useEffect } from 'react';
import { Activity, Play, ArrowRight } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';

export default function QueueOverviewPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi('/api/v1/campaigns')
      .then(data => setCampaigns(data?.items || data || []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Activity className="h-7 w-7 text-blue-600" />
          Real-Time Call Queue Monitor
        </h1>
        <p className="text-gray-500 text-sm mt-1">Select an active campaign below to monitor live concurrent calls, priority score calculations, and retries</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-gray-400">Loading active queues...</div>
        ) : campaigns.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-gray-400">No campaigns found</div>
        ) : (
          campaigns.map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                    c.status === 'RUNNING' ? 'bg-green-100 text-green-800 animate-pulse' :
                    c.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {c.status}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">Max: {c.max_concurrent_calls} lines</span>
                </div>
                <h3 className="font-bold text-gray-900 text-base mb-1">{c.name}</h3>
                <p className="text-xs text-gray-500 mb-4">{c.description || 'Post-discharge cohort'}</p>
                
                <div className="space-y-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg mb-4">
                  <div className="flex justify-between">
                    <span>Eligible Patients:</span>
                    <span className="font-semibold text-gray-900">{c.total_eligible || 100}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed Outreach:</span>
                    <span className="font-semibold text-green-600">{c.total_completed || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Escalated Acuity:</span>
                    <span className="font-semibold text-red-600">{c.total_escalated || 0}</span>
                  </div>
                </div>
              </div>

              <Link
                href={`/campaigns/${c.id}`}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
              >
                Open Live Queue Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
