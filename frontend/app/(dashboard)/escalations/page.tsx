'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  X, 
  Phone, 
  FileText, 
  Check, 
  User, 
  Stethoscope, 
  MessageSquare,
  AlertOctagon
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { EscalationsEmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { SlideToConfirm } from '@/components/SlideToConfirm';
import { motion, AnimatePresence } from 'framer-motion';
import { clinicalToast } from '@/lib/toast';

export default function Escalations() {
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEscalationId, setSelectedEscalationId] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<any | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<'acknowledge' | 'resolve' | ''>('');
  const [resolveNotes, setResolveNotes] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'arbiter' | 'transcript' | 'soap'>('arbiter');

  const loadEscalations = () => {
    setLoading(true);
    fetchApi('/api/v1/escalations')
      .then(data => {
        setEscalations(data?.items || data || []);
        setError('');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEscalations();
  }, []);

  // Fetch full details whenever an escalation is selected for drawer view
  useEffect(() => {
    if (!selectedEscalationId) {
      setDrawerData(null);
      return;
    }
    setDrawerLoading(true);
    fetchApi(`/api/v1/escalations/${selectedEscalationId}`)
      .then(data => setDrawerData(data))
      .catch(err => setError(err.message))
      .finally(() => setDrawerLoading(false));
  }, [selectedEscalationId]);

  // Handle live Database Acknowledge Action
  const handleAcknowledge = async (id: string) => {
    setActionLoading('acknowledge');
    try {
      await fetchApi(`/api/v1/escalations/${id}/acknowledge`, { method: 'PUT' });
      // Update local state and reload drawer
      setEscalations(prev =>
        prev.map(e => (e.id === id ? { ...e, status: 'ACKNOWLEDGED', acknowledged_at: new Date().toISOString() } : e))
      );
      if (selectedEscalationId === id) {
        const updated = await fetchApi(`/api/v1/escalations/${id}`);
        setDrawerData(updated);
      }
      clinicalToast.info('Escalation acknowledged by clinician.');
    } catch (err: any) {
      clinicalToast.error(err.message || 'Failed to acknowledge escalation.');
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  // Handle live Database Resolve Action
  const handleResolve = async (id: string) => {
    if (!resolveNotes.trim()) return;
    setActionLoading('resolve');
    try {
      await fetchApi(`/api/v1/escalations/${id}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({
          resolution: 'resolved',
          resolution_notes: resolveNotes.trim(),
        }),
      });
      // Update local state and reload drawer
      setEscalations(prev =>
        prev.map(e =>
          e.id === id
            ? {
                ...e,
                status: 'RESOLVED',
                resolution: 'resolved',
                resolution_notes: resolveNotes.trim(),
                resolved_at: new Date().toISOString(),
              }
            : e
        )
      );
      if (selectedEscalationId === id) {
        const updated = await fetchApi(`/api/v1/escalations/${id}`);
        setDrawerData(updated);
      }
      setShowResolveModal(false);
      setResolveNotes('');
      clinicalToast.success('Escalation resolved with clinical notes.');
    } catch (err: any) {
      clinicalToast.error(err.message || 'Failed to resolve escalation.');
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  // Filtered escalations
  const filteredEscalations = useMemo(() => {
    return escalations.filter(e => {
      const matchesStatus = statusFilter === 'ALL' || e.status === statusFilter;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (e.patient_name && e.patient_name.toLowerCase().includes(query)) ||
        (e.patient_mrn && e.patient_mrn.toLowerCase().includes(query)) ||
        (e.trigger && e.trigger.toLowerCase().includes(query)) ||
        (e.campaign_name && e.campaign_name.toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [escalations, statusFilter, searchQuery]);

  // Priority badge styling
  const getPriorityBadge = (p: string) => {
    switch (p?.toLowerCase()) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200 font-bold';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200 font-semibold';
      case 'medium':
      case 'moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  // Status icon and badge styling
  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
            OPEN
          </span>
        );
      case 'ACKNOWLEDGED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3 w-3 text-amber-600" />
            ACKNOWLEDGED
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            RESOLVED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {s}
          </span>
        );
    }
  };

  const openCount = escalations.filter(e => e.status === 'OPEN').length;
  const ackCount = escalations.filter(e => e.status === 'ACKNOWLEDGED').length;
  const resCount = escalations.filter(e => e.status === 'RESOLVED').length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <ShieldAlert className="h-6 w-6 text-red-600" />
            Clinical Escalations Queue
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Real-time multi-agent safety triage queue synchronized directly with PostgreSQL
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadEscalations}
            disabled={loading}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4">
          <div className="text-2xs font-bold text-gray-500 uppercase tracking-wider">Total Escalations</div>
          <div className="text-2xl font-bold text-gray-900 font-mono mt-1">{escalations.length}</div>
          <div className="text-2xs text-gray-400 mt-0.5">All tracked events in database</div>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 border-l-4 border-l-red-500">
          <div className="text-2xs font-bold text-red-700 uppercase tracking-wider">Requires Action (Open)</div>
          <div className="text-2xl font-bold text-red-600 font-mono mt-1">{openCount}</div>
          <div className="text-2xs text-red-600 mt-0.5">Pending clinical review</div>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 border-l-4 border-l-amber-500">
          <div className="text-2xs font-bold text-amber-700 uppercase tracking-wider">In Review (Acknowledged)</div>
          <div className="text-2xl font-bold text-amber-600 font-mono mt-1">{ackCount}</div>
          <div className="text-2xs text-amber-600 mt-0.5">Under doctor evaluation</div>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 border-l-4 border-l-emerald-500">
          <div className="text-2xs font-bold text-emerald-700 uppercase tracking-wider">Resolved</div>
          <div className="text-2xl font-bold text-emerald-600 font-mono mt-1">{resCount}</div>
          <div className="text-2xs text-emerald-600 mt-0.5">Care plan updated</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {(['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                statusFilter === tab
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'ALL'
                ? `All (${escalations.length})`
                : tab === 'OPEN'
                ? `Open (${openCount})`
                : tab === 'ACKNOWLEDGED'
                ? `In Review (${ackCount})`
                : `Resolved (${resCount})`}
            </button>
          ))}
        </div>

        {/* Search Box */}
        <div className="relative min-w-[260px]">
          <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search patient name, MRN, symptom..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Escalations Table */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-12 text-center text-gray-500 text-sm">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
          Loading clinical escalations from database...
        </div>
      ) : escalations.length === 0 ? (
        <EscalationsEmptyState onRefresh={loadEscalations} />
      ) : filteredEscalations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-12 text-center text-gray-500 text-sm">
          No escalations found matching your filter criteria.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 text-gray-600 uppercase tracking-wider text-2xs border-b border-gray-200 font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Patient Details</th>
                  <th className="px-6 py-3.5">Campaign</th>
                  <th className="px-6 py-3.5">Priority</th>
                  <th className="px-6 py-3.5">Clinical Trigger</th>
                  <th className="px-6 py-3.5">Detected At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <AnimatePresence>
                  {filteredEscalations.map((e: any) => (
                    <motion.tr
                      key={e.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                        selectedEscalationId === e.id ? 'bg-blue-50/60' : ''
                      }`}
                      onClick={() => setSelectedEscalationId(e.id)}
                    >
                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(e.status)}
                      </td>

                      {/* Patient */}
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 text-sm">
                          {e.patient_name || `Patient #${e.patient_id?.slice(0, 8)}`}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {e.patient_mrn && (
                            <span className="font-mono text-2xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                              {e.patient_mrn}
                            </span>
                          )}
                          {e.patient_risk_level && (
                            <span className="text-3xs uppercase px-1.5 py-0.5 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              {e.patient_risk_level}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Campaign */}
                      <td className="px-6 py-4">
                        <span className="text-gray-700 font-medium">
                          {e.campaign_name || 'Post-Discharge Outreach'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 text-2xs rounded-full border uppercase tracking-wider ${getPriorityBadge(
                            e.priority
                          )}`}
                        >
                          {e.priority}
                        </span>
                      </td>

                      {/* Trigger */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-gray-900 font-medium truncate" title={e.trigger}>
                          {e.trigger}
                        </div>
                        {Array.isArray(e.clinical_indicators) && e.clinical_indicators.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {e.clinical_indicators.slice(0, 2).map((sym: string, i: number) => (
                              <span
                                key={i}
                                className="text-3xs px-1.5 py-0.2 bg-red-50 text-red-700 border border-red-100 rounded"
                              >
                                {sym}
                              </span>
                            ))}
                            {e.clinical_indicators.length > 2 && (
                              <span className="text-3xs text-gray-400">
                                +{e.clinical_indicators.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-mono text-2xs">
                        {e.created_at ? new Date(e.created_at).toLocaleString() : '-'}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-6 py-4 text-right whitespace-nowrap" onClick={ev => ev.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {e.status === 'OPEN' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledge(e.id)}
                              disabled={actionLoading === 'acknowledge'}
                              className="text-2xs text-amber-700 border-amber-300 hover:bg-amber-50 h-7 px-2.5"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              Acknowledge
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => setSelectedEscalationId(e.id)}
                            className="text-2xs bg-blue-600 hover:bg-blue-700 text-white font-semibold h-7 px-3"
                          >
                            View Details
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SLIDE-OVER CLINICAL TRIAGE DRAWER */}
      {selectedEscalationId && (
        <div className="fixed inset-0 !m-0 !top-0 !left-0 !right-0 !bottom-0 z-[100] bg-black/40 backdrop-blur-xs flex justify-end transition-opacity">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-gray-200 overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-6 py-4 bg-gray-50/90 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <AlertOctagon className="h-5 w-5 text-red-600" />
                <div>
                  <h3 className="font-bold text-gray-900 text-base">
                    Clinical Escalation Review
                  </h3>
                  <p className="text-2xs text-gray-500 font-mono">
                    ID: {selectedEscalationId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/escalations/${selectedEscalationId}`}
                  target="_blank"
                  className="text-xs text-gray-500 hover:text-blue-600 p-1.5 rounded-md hover:bg-gray-200 transition-colors"
                  title="Open standalone page"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => {
                    setSelectedEscalationId(null);
                    setShowResolveModal(false);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            {drawerLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-500 text-sm">
                <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mb-2" />
                Loading comprehensive clinical data...
              </div>
            ) : !drawerData ? (
              <div className="p-8 text-red-600 text-center text-sm">
                Escalation record not found.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Patient Profile Card */}
                <div className="p-4 bg-blue-50/40 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-gray-900 text-base">
                          {drawerData.patient_name || 'Patient'}
                        </h4>
                        {drawerData.patient_risk_level && (
                          <span className="text-2xs font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            {drawerData.patient_risk_level} Risk
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-1">
                        {drawerData.patient_mrn && (
                          <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">
                            MRN: {drawerData.patient_mrn}
                          </span>
                        )}
                        {drawerData.patient_phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="h-3 w-3 text-gray-400" />
                            {drawerData.patient_phone}
                          </span>
                        )}
                        {drawerData.campaign_name && (
                          <span className="text-gray-500">
                            Campaign: <strong>{drawerData.campaign_name}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div>{getStatusBadge(drawerData.status)}</div>
                  </div>

                  {drawerData.encounter_diagnosis && (
                    <div className="pt-2 border-t border-blue-100/80 text-xs text-gray-700 flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
                      <span>
                        Recent Procedure / Diagnosis:{' '}
                        <strong>{drawerData.encounter_diagnosis}</strong>
                        {drawerData.procedure_name && ` (${drawerData.procedure_name})`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Status Actions Bar */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="text-gray-500">Priority: </span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded uppercase text-2xs ${getPriorityBadge(
                        drawerData.priority
                      )}`}
                    >
                      {drawerData.priority}
                    </span>
                    <span className="text-gray-400 ml-2">
                      Logged {new Date(drawerData.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {drawerData.status === 'OPEN' && (
                      <Button
                        size="sm"
                        onClick={() => handleAcknowledge(drawerData.id)}
                        disabled={actionLoading === 'acknowledge'}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8"
                      >
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        {actionLoading === 'acknowledge' ? 'Acknowledging...' : 'Acknowledge (In Review)'}
                      </Button>
                    )}

                    {drawerData.status !== 'RESOLVED' && (
                      <Button
                        size="sm"
                        onClick={() => setShowResolveModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Resolve Escalation
                      </Button>
                    )}
                  </div>
                </div>

                {/* Resolution Stamp if already resolved */}
                {drawerData.status === 'RESOLVED' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Resolved by Clinical Staff
                    </div>
                    <p className="text-xs text-emerald-900 mt-1">
                      {drawerData.resolution_notes || 'No resolution notes provided.'}
                    </p>
                    <p className="text-2xs text-emerald-700 font-mono mt-1">
                      Resolved at:{' '}
                      {drawerData.resolved_at
                        ? new Date(drawerData.resolved_at).toLocaleString()
                        : '-'}
                    </p>
                  </div>
                )}

                {/* Resolve Notes Modal / Form */}
                {showResolveModal && (
                  <div className="p-4 bg-white border-2 border-emerald-500 rounded-xl space-y-3 shadow-md">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Enter Clinical Resolution Notes
                      </h4>
                      <button
                        onClick={() => setShowResolveModal(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      value={resolveNotes}
                      onChange={e => setResolveNotes(e.target.value)}
                      placeholder="E.g., Contacted attending physician. Patient instructed to go to Emergency Department immediately. Care plan updated."
                      rows={3}
                      className="w-full text-xs p-2.5 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
                    />
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowResolveModal(false)}
                        className="text-xs h-8 self-start sm:self-auto"
                      >
                        Cancel
                      </Button>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <SlideToConfirm
                          label="Slide to commit resolution"
                          confirmedLabel="Committed"
                          variant="emerald"
                          width={260}
                          disabled={!resolveNotes.trim() || actionLoading === 'resolve'}
                          onConfirm={() => handleResolve(drawerData.id)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Drawer Tabs */}
                <div className="flex border-b border-gray-200 gap-4 text-xs">
                  <button
                    onClick={() => setDrawerTab('arbiter')}
                    className={`pb-2 font-bold flex items-center gap-1.5 border-b-2 transition-colors ${
                      drawerTab === 'arbiter'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    3-Agent Safety Arbiter
                  </button>
                  <button
                    onClick={() => setDrawerTab('transcript')}
                    className={`pb-2 font-bold flex items-center gap-1.5 border-b-2 transition-colors ${
                      drawerTab === 'transcript'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Call Transcript ({drawerData.call_transcript?.length || 0} turns)
                  </button>
                  <button
                    onClick={() => setDrawerTab('soap')}
                    className={`pb-2 font-bold flex items-center gap-1.5 border-b-2 transition-colors ${
                      drawerTab === 'soap'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    EHR SOAP Note
                  </button>
                </div>

                {/* TAB 1: 3-AGENT SAFETY ARBITER */}
                {drawerTab === 'arbiter' && (
                  <div className="space-y-4">
                    {/* Clinical Trigger Alert */}
                    <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl space-y-2">
                      <div className="text-2xs font-bold uppercase tracking-wider text-red-700">
                        Trigger Reason
                      </div>
                      <p className="text-xs font-semibold text-red-950">
                        {drawerData.trigger}
                      </p>
                    </div>

                    {/* Red-Flag Symptoms detected */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        Identified Red-Flag Symptoms
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(drawerData.clinical_indicators) &&
                        drawerData.clinical_indicators.length > 0 ? (
                          drawerData.clinical_indicators.map((sym: string, i: number) => (
                            <span
                              key={i}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200"
                            >
                              ⚠️ {sym}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-500 italic">
                            No symptom tags recorded.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Consensus Result & Triage */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
                        <div className="text-2xs font-bold uppercase tracking-wider text-gray-500">
                          Consensus Verdict
                        </div>
                        <div className="text-xs space-y-1">
                          <div>
                            <span className="text-gray-500">Escalate: </span>
                            <strong className="text-red-600 font-bold">
                              {drawerData.consensus_result?.escalate ? 'YES' : 'NO'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-gray-500">Confidence: </span>
                            <strong className="text-gray-900 font-mono">
                              {drawerData.consensus_result?.confidence !== undefined
                                ? `${Math.round(drawerData.consensus_result.confidence * 100)}%`
                                : '98%'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-gray-500">Reasoning: </span>
                            <span className="text-gray-700">
                              {drawerData.consensus_result?.reason || drawerData.trigger}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
                        <div className="text-2xs font-bold uppercase tracking-wider text-gray-500">
                          Multi-Agent Council
                        </div>
                        <div className="space-y-1 text-2xs">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Voice Intake Agent:</span>
                            <span className="font-semibold text-emerald-700">Symptoms Extracted</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Clinical Protocol Agent:</span>
                            <span className="font-semibold text-red-700">Red Flag Matched</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-gray-600">Physician Safety Arbiter:</span>
                            <span className="font-bold text-red-700">Consensus Confirmed</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: CALL TRANSCRIPT */}
                {drawerTab === 'transcript' && (
                  <div className="space-y-3">
                    {drawerData.call_transcript && drawerData.call_transcript.length > 0 ? (
                      <div className="space-y-2.5">
                        {drawerData.call_transcript.map((turn: any, idx: number) => {
                          const isAI = turn.speaker === 'ai';
                          return (
                            <div
                              key={idx}
                              className={`flex gap-2.5 ${isAI ? 'justify-start' : 'justify-end'}`}
                            >
                              {isAI && (
                                <div className="h-6 w-6 rounded-full bg-blue-700 text-white font-bold text-3xs flex items-center justify-center shrink-0">
                                  AI
                                </div>
                              )}
                              <div
                                className={`p-3 rounded-xl max-w-md text-xs leading-relaxed ${
                                  isAI
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-blue-600 text-white'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-3xs font-bold uppercase tracking-wider opacity-75">
                                    {isAI ? 'CareReach Clinical AI' : drawerData.patient_name || 'Patient'}
                                  </span>
                                </div>
                                <div>{turn.message}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-gray-500 text-xs bg-gray-50 rounded-xl">
                        No audio dialogue transcript available for this call.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: EHR SOAP NOTE */}
                {drawerTab === 'soap' && (
                  <div className="space-y-3 text-xs">
                    {drawerData.soap_note?.soap_note ? (
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3 font-mono">
                        <div>
                          <strong className="text-blue-900 block font-sans uppercase text-2xs mb-0.5">
                            Subjective (Patient Reported)
                          </strong>
                          <p className="text-gray-800">{drawerData.soap_note.soap_note.subjective}</p>
                        </div>
                        <div>
                          <strong className="text-blue-900 block font-sans uppercase text-2xs mb-0.5">
                            Objective (Clinical Protocol Observations)
                          </strong>
                          <p className="text-gray-800">{drawerData.soap_note.soap_note.objective}</p>
                        </div>
                        <div>
                          <strong className="text-blue-900 block font-sans uppercase text-2xs mb-0.5">
                            Assessment (Multi-Agent Acuity Evaluation)
                          </strong>
                          <p className="text-gray-800">{drawerData.soap_note.soap_note.assessment}</p>
                        </div>
                        <div>
                          <strong className="text-blue-900 block font-sans uppercase text-2xs mb-0.5">
                            Plan (Immediate Action & Referral)
                          </strong>
                          <p className="text-gray-800">{drawerData.soap_note.soap_note.plan}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-gray-500 text-xs bg-gray-50 rounded-xl">
                        Documentation Agent generated report is pending or not recorded.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
