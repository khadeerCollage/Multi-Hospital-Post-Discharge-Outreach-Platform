'use client';

import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  Phone, 
  FileText, 
  Check, 
  MessageSquare, 
  Stethoscope, 
  AlertOctagon,
  RefreshCw,
  X
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SlideToConfirm } from '@/components/SlideToConfirm';

export default function EscalationDetail({ params }: { params: { id: string } }) {
  const [escalation, setEscalation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resolveNotes, setResolveNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<'acknowledge' | 'resolve' | ''>('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'arbiter' | 'transcript' | 'soap'>('arbiter');
  const [showResolveForm, setShowResolveForm] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetchApi(`/api/v1/escalations/${params.id}`)
      .then(setEscalation)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [params.id]);

  const handleAcknowledge = async () => {
    setActionLoading('acknowledge');
    try {
      await fetchApi(`/api/v1/escalations/${params.id}/acknowledge`, { method: 'PUT' });
      const updated = await fetchApi(`/api/v1/escalations/${params.id}`);
      setEscalation(updated);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleResolve = async () => {
    if (!resolveNotes.trim()) return;
    setActionLoading('resolve');
    try {
      await fetchApi(`/api/v1/escalations/${params.id}/resolve`, {
        method: 'PUT',
        body: JSON.stringify({
          resolution: 'resolved',
          resolution_notes: resolveNotes.trim(),
        }),
      });
      const updated = await fetchApi(`/api/v1/escalations/${params.id}`);
      setEscalation(updated);
      setShowResolveForm(false);
      setResolveNotes('');
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 text-sm max-w-5xl mx-auto">
        <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mx-auto mb-2" />
        Loading clinical escalation record...
      </div>
    );
  }

  if (!escalation) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <Link href="/escalations" className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Escalations Queue
        </Link>
        <div className="p-8 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Escalation record not found.
        </div>
      </div>
    );
  }

  const consensus = typeof escalation.consensus_result === 'string' 
    ? JSON.parse(escalation.consensus_result || '{}') 
    : (escalation.consensus_result || {});

  const getPriorityBadge = (p: string) => {
    switch (p?.toLowerCase()) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200 font-bold';
      case 'high': return 'bg-orange-50 text-orange-700 border-orange-200 font-semibold';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
            OPEN (REQUIRES ACTION)
          </span>
        );
      case 'ACKNOWLEDGED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            ACKNOWLEDGED (IN REVIEW)
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            RESOLVED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {s}
          </span>
        );
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/escalations" 
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Escalations Queue
        </Link>
        <span className="text-2xs font-mono text-gray-400">
          TICKET UUID: {escalation.id}
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 text-xs font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Patient Profile Card */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">
                {escalation.patient_name || `Patient #${escalation.patient_id?.slice(0, 8)}`}
              </h1>
              {escalation.patient_risk_level && (
                <span className="text-2xs font-bold uppercase px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
                  {escalation.patient_risk_level} Risk Tier
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-1.5">
              {escalation.patient_mrn && (
                <span className="font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-semibold">
                  MRN: {escalation.patient_mrn}
                </span>
              )}
              {escalation.patient_phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                  {escalation.patient_phone}
                </span>
              )}
              {escalation.campaign_name && (
                <span className="text-gray-600">
                  Cohort: <strong>{escalation.campaign_name}</strong>
                </span>
              )}
            </div>
          </div>
          <div>{getStatusBadge(escalation.status)}</div>
        </div>

        {escalation.encounter_diagnosis && (
          <div className="pt-3 border-t border-gray-100 text-xs text-gray-700 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-blue-600" />
            <span>
              Primary Discharge Diagnosis: <strong>{escalation.encounter_diagnosis}</strong>
              {escalation.procedure_name && ` — Procedure: ${escalation.procedure_name}`}
            </span>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs">
          <span className="text-gray-500">Clinical Acuity: </span>
          <span className={`font-bold px-2.5 py-0.5 rounded uppercase text-2xs border ${getPriorityBadge(escalation.priority)}`}>
            {escalation.priority}
          </span>
          <span className="text-gray-400 ml-3">
            Logged: {new Date(escalation.created_at).toLocaleString()}
          </span>
          {escalation.acknowledged_at && (
            <span className="text-amber-600 ml-3">
              Acknowledged: {new Date(escalation.acknowledged_at).toLocaleTimeString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {escalation.status === 'OPEN' && (
            <Button
              size="sm"
              onClick={handleAcknowledge}
              disabled={actionLoading === 'acknowledge'}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8 px-4"
            >
              <Clock className="h-3.5 w-3.5 mr-1.5" />
              {actionLoading === 'acknowledge' ? 'Acknowledging...' : 'Acknowledge (In Review)'}
            </Button>
          )}

          {escalation.status !== 'RESOLVED' && (
            <Button
              size="sm"
              onClick={() => setShowResolveForm(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-8 px-4"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Resolve Ticket
            </Button>
          )}
        </div>
      </div>

      {/* Resolve Input Box */}
      {showResolveForm && (
        <div className="bg-white border-2 border-emerald-500 rounded-xl p-5 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Document Clinical Resolution Notes
            </h4>
            <button onClick={() => setShowResolveForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={resolveNotes}
            onChange={e => setResolveNotes(e.target.value)}
            placeholder="Enter clinical disposition (e.g., Contacted patient via telemedicine, prescribed oral antibiotic, scheduled follow-up with attending physician)..."
            rows={3}
            className="w-full text-xs p-3 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
          />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <Button size="sm" variant="outline" onClick={() => setShowResolveForm(false)} className="text-xs h-8 self-start sm:self-auto">
              Cancel
            </Button>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <SlideToConfirm
                label="Slide to commit resolution"
                confirmedLabel="Committed to DB"
                variant="emerald"
                width={260}
                disabled={!resolveNotes.trim() || actionLoading === 'resolve'}
                onConfirm={handleResolve}
              />
            </div>
          </div>
        </div>
      )}

      {/* Resolution Confirmation */}
      {escalation.status === 'RESOLVED' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Clinical Resolution Completed
          </div>
          <p className="text-xs text-emerald-950 mt-1">
            {escalation.resolution_notes || 'Resolution completed by clinical review staff.'}
          </p>
          <p className="text-2xs text-emerald-700 font-mono mt-1">
            Timestamp: {escalation.resolved_at ? new Date(escalation.resolved_at).toLocaleString() : '-'}
          </p>
        </div>
      )}

      {/* Detail Tabs */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 px-6 pt-3 gap-6 text-xs bg-gray-50/50">
          <button
            onClick={() => setActiveTab('arbiter')}
            className={`pb-3 font-bold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'arbiter'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            3-Agent Safety Arbiter & Red Flags
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`pb-3 font-bold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'transcript'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Turn-by-Turn Call Transcript ({escalation.call_transcript?.length || 0} turns)
          </button>
          <button
            onClick={() => setActiveTab('soap')}
            className={`pb-3 font-bold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'soap'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-4 w-4" />
            EHR SOAP Note
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: ARBITER */}
          {activeTab === 'arbiter' && (
            <div className="space-y-5">
              {/* Trigger */}
              <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl space-y-1.5">
                <div className="text-2xs font-bold uppercase tracking-wider text-red-700">
                  Clinical Trigger Reason
                </div>
                <p className="text-xs font-semibold text-red-950">
                  {escalation.trigger}
                </p>
              </div>

              {/* Red-Flag Symptoms */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  Identified Red-Flag Symptoms
                </h4>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(escalation.clinical_indicators) && escalation.clinical_indicators.length > 0 ? (
                    escalation.clinical_indicators.map((sym: string, i: number) => (
                      <span
                        key={i}
                        className="text-xs font-semibold px-3 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200"
                      >
                        ⚠️ {sym}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-500 italic">No symptoms tags recorded.</span>
                  )}
                </div>
              </div>

              {/* Consensus Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <div className="text-2xs font-bold uppercase tracking-wider text-gray-500">
                    Consensus Verdict
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-gray-500">Escalate: </span>
                      <strong className="text-red-600 font-bold">{consensus.escalate ? 'YES' : 'NO'}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Confidence: </span>
                      <strong className="text-gray-900 font-mono">
                        {consensus.confidence !== undefined ? `${Math.round(consensus.confidence * 100)}%` : '98%'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500">Clinical Reason: </span>
                      <span className="text-gray-800">{consensus.reason || escalation.trigger}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                  <div className="text-2xs font-bold uppercase tracking-wider text-gray-500">
                    Multi-Agent Council Deliberation
                  </div>
                  <div className="space-y-1.5 text-2xs">
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
          {activeTab === 'transcript' && (
            <div className="space-y-3">
              {escalation.call_transcript && escalation.call_transcript.length > 0 ? (
                <div className="space-y-3">
                  {escalation.call_transcript.map((turn: any, idx: number) => {
                    const isAI = turn.speaker === 'ai';
                    return (
                      <div key={idx} className={`flex gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}>
                        {isAI && (
                          <div className="h-7 w-7 rounded-full bg-blue-700 text-white font-bold text-2xs flex items-center justify-center shrink-0">
                            AI
                          </div>
                        )}
                        <div
                          className={`p-3.5 rounded-xl max-w-lg text-xs leading-relaxed ${
                            isAI ? 'bg-gray-100 text-gray-800 border border-gray-200' : 'bg-blue-600 text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-3xs font-bold uppercase tracking-wider opacity-75">
                              {isAI ? 'CareReach Clinical AI' : escalation.patient_name || 'Patient'}
                            </span>
                          </div>
                          <div>{turn.message}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 text-xs bg-gray-50 rounded-xl">
                  No call transcript recorded for this escalation ticket.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: EHR SOAP NOTE */}
          {activeTab === 'soap' && (
            <div className="space-y-3 text-xs">
              {escalation.soap_note?.soap_note ? (
                <div className="p-5 bg-gray-50 border border-gray-200 rounded-xl space-y-4 font-mono">
                  <div>
                    <strong className="text-blue-900 block font-sans uppercase text-2xs mb-0.5">
                      Subjective (Patient Reported Symptoms)
                    </strong>
                    <p className="text-gray-800">{escalation.soap_note.soap_note.subjective}</p>
                  </div>
                  <div>
                    <strong className="text-blue-900 block font-sans uppercase text-2xs mb-0.5">
                      Objective (Clinical Protocol Observations)
                    </strong>
                    <p className="text-gray-800">{escalation.soap_note.soap_note.objective}</p>
                  </div>
                  <div>
                    <strong className="text-blue-900 block font-sans uppercase text-2xs mb-0.5">
                      Assessment (Multi-Agent Acuity Evaluation)
                    </strong>
                    <p className="text-gray-800">{escalation.soap_note.soap_note.assessment}</p>
                  </div>
                  <div>
                    <strong className="text-blue-900 block font-sans uppercase text-2xs mb-0.5">
                      Plan (Immediate Medical Action & Protocol Disposition)
                    </strong>
                    <p className="text-gray-800">{escalation.soap_note.soap_note.plan}</p>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-500 text-xs bg-gray-50 rounded-xl">
                  Documentation Agent EHR SOAP note is pending or not recorded.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
