"use client";

import { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  ArrowLeft, 
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Radio,
  Clock
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import dynamic from 'next/dynamic';

// Dynamically import OutreachOrchestratorModal for client-side rendering
const OutreachOrchestratorModal = dynamic(
  () => import('@/components/OutreachOrchestratorModal'),
  { ssr: false }
);

export default function CampaignDetail({ params }: { params: { id: string } }) {
  const [campaign, setCampaign] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');

  // Unified Outreach Orchestrator Modal State
  const [showOrchestrator, setShowOrchestrator] = useState(false);

  const fetchData = async () => {
    try {
      const [campaignData, queueData, taskData] = await Promise.allSettled([
        fetchApi(`/api/v1/campaigns/${params.id}`),
        fetchApi(`/api/v1/queue/${params.id}/status`),
        fetchApi(`/api/v1/queue/${params.id}/tasks`),
      ]);
      if (campaignData.status === 'fulfilled') setCampaign(campaignData.value);
      if (queueData.status === 'fulfilled') setQueueStatus(queueData.value);
      if (taskData.status === 'fulfilled') {
        const items = taskData.value?.items || taskData.value || [];
        setTasks(items);
      }
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [params.id]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      await fetchApi(`/api/v1/campaigns/${params.id}/${action}`, { method: 'POST' });
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800 border-gray-200',
      READY: 'bg-blue-100 text-blue-800 border-blue-200',
      RUNNING: 'bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse',
      PAUSED: 'bg-amber-100 text-amber-800 border-amber-200',
      COMPLETED: 'bg-purple-100 text-purple-800 border-purple-200',
      CANCELLED: 'bg-red-100 text-red-800 border-red-200',
      PENDING: 'bg-gray-100 text-gray-700 border-gray-200',
      CALLING: 'bg-blue-100 text-blue-700 border-blue-200',
      RETRY_SCHEDULED: 'bg-amber-100 text-amber-700 border-amber-200',
      ESCALATED: 'bg-red-100 text-red-700 border-red-200 font-bold',
      MANUAL_FOLLOW_UP: 'bg-orange-100 text-orange-700 border-orange-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  if (loading) return <div className="p-8 text-gray-500">Loading campaign queue...</div>;

  const q = queueStatus || {};
  const active = q.active_calls || 0;
  const maxCalls = q.capacity_total || campaign?.max_concurrent_calls || 10;
  const pct = maxCalls > 0 ? Math.round((active / maxCalls) * 100) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/campaigns" className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Campaigns
        </Link>
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-900">
              {campaign?.name || 'Campaign'}
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadge(campaign?.status || '')}`}>
                {campaign?.status}
              </span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">{campaign?.description || 'Automated post-discharge patient outreach cohort'}</p>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Unified Outreach Console Button */}
            <button
              onClick={() => setShowOrchestrator(true)}
              className="group inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-all duration-150 hover:shadow-md hover:shadow-blue-900/20 active:scale-[0.98]"
            >
              <Radio className="h-4 w-4 text-blue-200 group-hover:scale-110 transition-transform" />
              <span>Launch Outreach Console</span>
            </button>

            {campaign?.status === 'DRAFT' && (
              <Button onClick={() => handleAction('prepare')} disabled={!!actionLoading} className="flex items-center gap-2">
                {actionLoading === 'prepare' ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4"/>}
                Prepare Tasks
              </Button>
            )}
            {campaign?.status === 'READY' && (
              <Button onClick={() => handleAction('start')} disabled={!!actionLoading} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                {actionLoading === 'start' ? <RefreshCw className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4"/>}
                Start Campaign
              </Button>
            )}
            {campaign?.status === 'RUNNING' && (
              <>
                <Button variant="outline" onClick={() => handleAction('pause')} disabled={!!actionLoading} className="flex items-center gap-1.5">
                  <Pause className="h-4 w-4"/> Pause
                </Button>
                <Button variant="destructive" onClick={() => handleAction('cancel')} disabled={!!actionLoading} className="flex items-center gap-1.5">
                  <Square className="h-4 w-4"/> Cancel
                </Button>
              </>
            )}
            {campaign?.status === 'PAUSED' && (
              <Button onClick={() => handleAction('resume')} disabled={!!actionLoading} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Play className="h-4 w-4"/> Resume
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-4 mb-6">{error}</div>}

      {/* Queue Capacity Bar with HoverCard Context */}
      <HoverCard openDelay={100}>
        <HoverCardTrigger className="w-full">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 cursor-help hover:border-blue-300 transition-colors">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-blue-600" />
                Live Telephony Concurrency Capacity
              </span>
              <span className="text-xs text-gray-500 font-mono">
                {active} / {maxCalls} active channels ({pct}%)
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </div>
        </HoverCardTrigger>
        <HoverCardContent side="top" className="w-80">
          <div className="space-y-1.5 text-xs">
            <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-blue-600" />
              Concurrency Slot Management
            </h4>
            <p className="text-gray-500">
              Each hospital tenant is capped at a maximum of <strong>{maxCalls} concurrent lines</strong>. Slot leases are protected by PostgreSQL <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">SKIP LOCKED</code>.
            </p>
          </div>
        </HoverCardContent>
      </HoverCard>

      {/* Campaign Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Eligible</div>
          <div className="text-2xl font-bold text-gray-900 font-mono">{campaign?.total_eligible || 0}</div>
          <div className="text-2xs text-gray-400 mt-1">Identified via EHR discharge feed</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Queue Completed</div>
          <div className="text-2xl font-bold text-green-600 font-mono">{campaign?.total_completed || 0}</div>
          <div className="text-2xs text-green-600 mt-1">
            {campaign?.total_eligible ? Math.round(((campaign?.total_completed || 0) / campaign.total_eligible) * 100) : 0}% completion rate
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Clinical Escalations</div>
          <div className="text-2xl font-bold text-red-600 font-mono">{campaign?.total_escalated || 0}</div>
          <div className="text-2xs text-red-600 mt-1">Transferred to on-call physician</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Calling Window</div>
          <div className="text-base font-bold text-gray-800 mt-1">
            {campaign?.calling_hours_start || '09:00'} - {campaign?.calling_hours_end || '18:00'}
          </div>
          <div className="text-2xs text-gray-400 mt-1">Tenant local timezone enforced</div>
        </div>
      </div>

      {/* Patient Outreach Task List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="font-bold text-gray-900 text-base">Post-Discharge Outreach Queue</h3>
            <p className="text-xs text-gray-500 mt-0.5">Tasks dispatched dynamically by acuity priority engine</p>
          </div>
          <span className="text-xs font-mono font-medium px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-gray-600">
            {tasks.length} total patients in cohort
          </span>
        </div>

        {tasks.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Layers className="h-6 w-6 text-gray-400" />
              </EmptyMedia>
              <EmptyTitle>No Outreach Tasks Queued</EmptyTitle>
              <EmptyDescription>
                This cohort does not have generated outreach tasks yet. Click <strong>Prepare Tasks</strong> in the header to populate the queue from EHR patient admissions.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-xs text-gray-500 uppercase font-semibold border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5">Patient Details</th>
                  <th className="px-6 py-3.5">Risk Tier</th>
                  <th className="px-6 py-3.5">Queue Status</th>
                  <th className="px-6 py-3.5">Priority Engine Score</th>
                  <th className="px-6 py-3.5">Attempts</th>
                  <th className="px-6 py-3.5 text-right">Last Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tasks.map((t: any) => (
                  <tr key={t.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{t.patient_name || 'Patient'}</div>
                      <div className="text-xs text-gray-400 font-mono">MRN: {t.patient_mrn || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-2xs font-bold rounded-full uppercase ${
                        t.patient_risk_level === 'critical' ? 'bg-red-100 text-red-800' :
                        t.patient_risk_level === 'high' ? 'bg-orange-100 text-orange-800' :
                        t.patient_risk_level === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {t.patient_risk_level || 'routine'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-2xs font-semibold rounded-full border ${getStatusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <HoverCard openDelay={100}>
                        <HoverCardTrigger>
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded cursor-help">
                            {t.priority_score !== undefined ? Number(t.priority_score).toFixed(1) : '10.0'}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" className="w-64">
                          <div className="space-y-1 text-xs">
                            <h4 className="font-bold text-gray-900">Priority Engine Weight</h4>
                            <p className="text-gray-500">
                              Calculated via Clinical Acuity + Time-Window Urgency + Aging Boost - Retry Penalty.
                            </p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {t.attempt_count} / {t.max_retries || 5}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500 text-xs font-mono">
                      {t.last_attempt_at ? new Date(t.last_attempt_at).toLocaleTimeString() : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══ UNIFIED OUTREACH ORCHESTRATOR MODAL (Batch Cohort & Single Patient Wizard) ═══ */}
      {showOrchestrator && (
        <OutreachOrchestratorModal
          campaignId={params.id}
          campaign={campaign}
          tasks={tasks}
          onClose={() => setShowOrchestrator(false)}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
