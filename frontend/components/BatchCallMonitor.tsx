'use client';
/**
 * BatchCallMonitor.tsx — Live Batch Command Center
 *
 * Full-screen overlay showing all 10 patients in a batch being called
 * simultaneously. Shows live transcript for each patient as the AI
 * voice agent speaks turn-by-turn using Browser Web Speech API (FREE FOREVER).
 *
 * Architecture:
 *  - Frontend calls simulate-batch API once → gets 10 patients' full results
 *  - Animates as "live" by revealing each patient card sequentially
 *  - Each card shows live transcript turn-by-turn with TTS playback
 *  - Progress bar shows batch N of total batches (e.g. Batch 1 of 10 for 100 patients)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, PhoneCall, ShieldAlert, CheckCircle2, AlertTriangle,
  Clock, RefreshCw, Volume2, VolumeX, SkipForward,
  ChevronRight, User, Activity, Mic, Zap, Square,
  ArrowRight, ExternalLink, Globe, Layers, FileText,
  PhoneForwarded, Cpu, AlertOctagon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { 
  speak, 
  stopSpeaking, 
  detectVoiceCapabilities, 
  VoiceLanguage, 
  SUPPORTED_LANGUAGES, 
  getClinicalTranslation 
} from '@/lib/voice/browserVoiceAdapter';

// ─── Types ───────────────────────────────────────────────────────────────────

type CallStatus = 'QUEUED' | 'DIALING' | 'CONNECTED' | 'ESCALATED' | 'COMPLETED' | 'FAILED';

interface PatientCallResult {
  slot: number;
  patient_id: string;
  patient_name: string;
  patient_risk_level: string;
  mrn: string;
  age: number;
  gender: string;
  primary_diagnosis: string;
  procedure_name: string;
  attending_physician: string;
  discharge_date: string;
  priority_score: number;
  scenario_type: string;
  call_outcome: string;
  duration_seconds: number;
  conversation: Array<{ speaker: string; message: string }>;
  extracted_symptoms: string[];
  escalation_id: string | null;
  call_id: string;
}

interface BatchResult {
  success: boolean;
  batch_number: number;
  batch_size: number;
  total_in_batch: number;
  escalated: number;
  completed: number;
  hospital_name: string;
  campaign_name: string;
  results: PatientCallResult[];
}

interface PatientCardState {
  result: PatientCallResult;
  status: CallStatus;
  visibleTurns: number;       // how many conversation turns are revealed so far
  isSpeaking: boolean;        // is TTS currently playing for this card
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface BatchCallMonitorProps {
  campaignId: string;
  totalPatients: number;      // how many patients total in this campaign
  onClose: () => void;
}

// ─── Scenario badge config ────────────────────────────────────────────────────

function scenarioBadge(scenario: string) {
  if (scenario === 'emergency') return { label: 'CRITICAL', cls: 'bg-red-600 text-white font-bold' };
  if (scenario === 'urgent')    return { label: 'URGENT',   cls: 'bg-amber-500 text-white font-semibold' };
  return                               { label: 'ROUTINE',  cls: 'bg-emerald-600 text-white font-semibold' };
}

function riskBadge(risk: string) {
  if (risk === 'critical') return 'bg-red-100 text-red-800 border border-red-300';
  if (risk === 'high')     return 'bg-orange-100 text-orange-800 border border-orange-300';
  if (risk === 'medium')   return 'bg-amber-100 text-amber-800 border border-amber-300';
  return                          'bg-emerald-100 text-emerald-800 border border-emerald-200';
}

function outcomeBadge(outcome: string) {
  if (outcome === 'ESCALATED') return { label: 'ESCALATED', cls: 'bg-red-600 text-white font-bold' };
  return                              { label: 'COMPLETED', cls: 'bg-emerald-600 text-white font-bold' };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function BatchCallMonitor({ campaignId, totalPatients, onClose }: BatchCallMonitorProps) {
  // ── State
  const [phase, setPhase] = useState<'SETUP' | 'LOADING' | 'REVEALING' | 'DONE'>('SETUP');
  const [batchOffset, setBatchOffset] = useState(0);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [cards, setCards] = useState<PatientCardState[]>([]);
  const [error, setError] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [scenarioType, setScenarioType] = useState<'mixed' | 'emergency' | 'urgent' | 'routine'>('mixed');
  const [expandedCard, setExpandedCard] = useState<number | null>(null); // slot index

  const [batchLang, setBatchLang] = useState<VoiceLanguage>('en');
  const batchLangRef = useRef<VoiceLanguage>('en');

  const handleBatchLangChange = (lang: VoiceLanguage) => {
    setBatchLang(lang);
    batchLangRef.current = lang;
    stopSpeaking();
  };

  // Campaign totals
  const batchSize = 10;
  const totalBatches = Math.ceil(totalPatients / batchSize);

  // ── Refs
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const voiceCapsRef = useRef<{ ttsAvailable: boolean } | null>(null);

  // ── On mount: detect voice capabilities
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const caps = detectVoiceCapabilities();
      voiceCapsRef.current = caps;
      setVoiceEnabled(caps.ttsAvailable);
    }
    return () => {
      stopSpeaking();
      cancelRef.current.cancelled = true;
    };
  }, []);

  // ── Run a batch ──────────────────────────────────────────────────────────────
  const runBatch = useCallback(async (offset: number) => {
    cancelRef.current = { cancelled: false };
    setPhase('LOADING');
    setBatchResult(null);
    setCards([]);
    setError('');
    setExpandedCard(null);
    stopSpeaking();

    try {
      const res: BatchResult = await fetchApi(`/api/v1/queue/${campaignId}/simulate-batch`, {
        method: 'POST',
        body: JSON.stringify({
          scenario_type: scenarioType,
          batch_size: batchSize,
          batch_offset: offset,
        }),
      });

      setBatchResult(res);
      setPhase('REVEALING');

      // Initialize all cards as QUEUED
      setCards(res.results.map(r => ({
        result: r,
        status: 'QUEUED',
        visibleTurns: 0,
        isSpeaking: false,
      })));

      // ── Animate each card sequentially — Dial → Connect → Transcript → Done
      for (let i = 0; i < res.results.length; i++) {
        if (cancelRef.current.cancelled) break;
        const patient = res.results[i];

        // Mark as DIALING
        setCards(prev => prev.map((c, idx) =>
          idx === i ? { ...c, status: 'DIALING' } : c
        ));
        await delay(600);
        if (cancelRef.current.cancelled) break;

        // Mark as CONNECTED
        setCards(prev => prev.map((c, idx) =>
          idx === i ? { ...c, status: 'CONNECTED' } : c
        ));
        await delay(400);

        // ── Reveal transcript turn by turn + TTS
        const convo = patient.conversation || [];
        for (let t = 0; t < convo.length; t++) {
          if (cancelRef.current.cancelled) break;

          // Reveal this turn
          setCards(prev => prev.map((c, idx) =>
            idx === i ? { ...c, visibleTurns: t + 1, isSpeaking: convo[t].speaker === 'ai' } : c
          ));

          const msg = convo[t];
          if (msg.speaker === 'ai' && voiceEnabled && voiceCapsRef.current?.ttsAvailable) {
            // Speak the AI turn in active batch language (English / Hindi / Telugu)
            await speak(msg.message.slice(0, 120), { lang: batchLangRef.current, rate: 1.1 });
          } else {
            // Patient turn: just pause visually
            await delay(msg.speaker === 'ai' ? 900 : 600);
          }
        }

        if (cancelRef.current.cancelled) break;

        // Mark as final outcome
        setCards(prev => prev.map((c, idx) =>
          idx === i ? {
            ...c,
            status: patient.call_outcome === 'ESCALATED' ? 'ESCALATED' : 'COMPLETED',
            isSpeaking: false,
          } : c
        ));

        // Short pause between patients
        await delay(300);
      }

      setPhase('DONE');
    } catch (err: any) {
      setError(err.message || 'Batch simulation failed.');
      setPhase('SETUP');
    }
  }, [campaignId, scenarioType, voiceEnabled]);

  const handleNextBatch = () => {
    const next = batchOffset + 1;
    if (next >= totalBatches) return;
    setBatchOffset(next);
    runBatch(next);
  };

  const handleStop = () => {
    cancelRef.current.cancelled = true;
    stopSpeaking();
    setPhase('DONE');
    setCards(prev => prev.map(c =>
      c.status === 'QUEUED' || c.status === 'DIALING' || c.status === 'CONNECTED'
        ? { ...c, status: 'FAILED', isSpeaking: false }
        : { ...c, isSpeaking: false }
    ));
  };

  // ── Stat counters from cards
  const completedCount = cards.filter(c => c.status === 'COMPLETED').length;
  const escalatedCount = cards.filter(c => c.status === 'ESCALATED').length;
  const activeCount = cards.filter(c => c.status === 'CONNECTED' || c.status === 'DIALING').length;
  const queuedCount = cards.filter(c => c.status === 'QUEUED').length;

  // Overall campaign progress
  const totalDone = batchOffset * batchSize + (phase === 'DONE' ? cards.length : completedCount + escalatedCount);
  const overallPct = totalPatients > 0 ? Math.round((totalDone / totalPatients) * 100) : 0;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 text-white overflow-hidden">

      {/* ═══ TOP BAR ═══ */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white">
              Live Batch Call Monitor
            </h1>
            <p className="text-xs text-gray-400">
              {batchResult?.hospital_name || 'Hospital'} — {batchResult?.campaign_name || 'Campaign'}
            </p>
          </div>
        </div>

        {/* Overall campaign progress */}
        <div className="flex-1 max-w-md mx-8">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Campaign Progress</span>
            <span className="font-mono font-bold text-white">{totalDone} / {totalPatients} patients</span>
          </div>
          <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-0.5 text-right">{overallPct}% complete</div>
        </div>

        {/* Language selector & Voice Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
            <span className="text-2xs font-bold text-gray-400 px-1 flex items-center gap-1">
              <Globe className="h-3 w-3 text-blue-400" /> Voice:
            </span>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleBatchLangChange(lang.code)}
                className={`px-2 py-0.5 rounded text-2xs font-bold transition-all flex items-center gap-1 ${
                  batchLang === lang.code
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
                title={`Switch batch voice to ${lang.name} (${lang.nativeName})`}
              >
                <span>{lang.nativeName}</span>
                <span className="text-3xs uppercase opacity-75">({lang.badge})</span>
              </button>
            ))}
          </div>

          <div className="text-right ml-1">
            <div className="text-xs text-gray-400">Current Batch</div>
            <div className="font-bold text-white font-mono">{batchOffset + 1} / {totalBatches}</div>
          </div>

          {voiceCapsRef.current?.ttsAvailable && (
            <button
              onClick={() => { setVoiceEnabled(v => !v); if (voiceEnabled) stopSpeaking(); }}
              className={`p-2 rounded-lg border text-xs transition-colors ${voiceEnabled ? 'bg-blue-900 border-blue-700 text-blue-300' : 'bg-gray-800 border-gray-600 text-gray-400'}`}
              title={voiceEnabled ? 'Mute AI voice' : 'Enable AI voice'}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
          )}
          <button onClick={onClose} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ═══ BATCH STATS BAR ═══ */}
      <div className="flex items-center gap-6 px-6 py-2 bg-gray-900 border-b border-gray-800 shrink-0 text-xs">
        <StatPill label="Queued" value={queuedCount} color="text-gray-400" icon={<Clock className="h-3 w-3" />} />
        <StatPill label="Dialing / Active" value={activeCount} color="text-blue-400" icon={<PhoneCall className="h-3 w-3" />} pulse />
        <StatPill label="Completed" value={completedCount} color="text-emerald-400" icon={<CheckCircle2 className="h-3 w-3" />} />
        <StatPill label="Escalated" value={escalatedCount} color="text-red-400" icon={<ShieldAlert className="h-3 w-3" />} />
        <div className="ml-auto flex items-center gap-2">
          {voiceCapsRef.current?.ttsAvailable && (
            <span className="text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5">
              <Volume2 className="h-3 w-3 text-emerald-400" /> Free Web Speech Audio
            </span>
          )}
          <span className="text-gray-500">Batch size: {batchSize} concurrent calls</span>
        </div>
      </div>

      {/* ═══ SETUP PANEL (before first run) ═══ */}
      {phase === 'SETUP' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <div className="text-center">
            <div className="h-16 w-16 rounded-2xl bg-blue-950/80 border border-blue-600/50 flex items-center justify-center mx-auto mb-4 text-blue-400 shadow-md">
              <Layers className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Hospital Batch Outreach Simulator</h2>
            <p className="text-gray-400 max-w-lg">
              This simulates how the real system processes <strong className="text-white">{totalPatients} patients</strong> in
              batches of <strong className="text-white">10 at a time</strong>, ordered by priority score.
              Each batch runs concurrently. You can watch the live transcription of every AI call.
            </p>
          </div>

          {/* How it works explainer */}
          <div className="grid grid-cols-4 gap-4 max-w-3xl w-full">
            {[
              { icon: <FileText className="h-6 w-6 text-blue-400" />, label: 'Priority Scoring', desc: 'All 100 patients ranked by risk level, discharge date, clinical urgency' },
              { icon: <PhoneForwarded className="h-6 w-6 text-indigo-400" />, label: 'Batch Dispatch', desc: 'Top 10 by priority score called simultaneously (Batch 1 of 10)' },
              { icon: <Cpu className="h-6 w-6 text-emerald-400" />, label: 'AI Pipeline', desc: 'Each call: Voice Intake → Triage → 3-Agent Council → SOAP Note' },
              { icon: <AlertOctagon className="h-6 w-6 text-red-400" />, label: 'Auto-Escalation', desc: 'Red-flag patients instantly escalated to on-call physician' },
            ].map((step, idx) => (
              <div key={idx} className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-4 text-center flex flex-col items-center">
                <div className="mb-2 p-2 rounded-lg bg-gray-900 border border-gray-700/60">{step.icon}</div>
                <div className="font-bold text-sm text-white mb-1">{step.label}</div>
                <div className="text-xs text-gray-400">{step.desc}</div>
              </div>
            ))}
          </div>

          {/* Scenario selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Batch Scenario Mix:</label>
            {(['mixed', 'emergency', 'urgent', 'routine'] as const).map(s => (
              <button
                key={s}
                onClick={() => setScenarioType(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  scenarioType === s
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {s === 'mixed' ? 'Mixed (Realistic)' : s === 'emergency' ? 'Critical Emergency' : s === 'urgent' ? 'Post-Op Complication' : 'Routine Recovery'}
              </button>
            ))}
          </div>

          {error && (
            <div className="text-red-400 bg-red-950 border border-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          <Button
            onClick={() => runBatch(0)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-base px-8 py-3 h-auto rounded-xl flex items-center gap-3 shadow-lg shadow-blue-900/40"
          >
            <Zap className="h-5 w-5" />
            Launch Batch 1 — Call Top 10 Priority Patients
          </Button>
        </div>
      )}

      {/* ═══ LOADING ═══ */}
      {phase === 'LOADING' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="h-10 w-10 text-blue-400 animate-spin" />
          <p className="text-blue-300 font-semibold text-lg">Running AI pipeline for Batch {batchOffset + 1}...</p>
          <p className="text-gray-500 text-sm">Processing {batchSize} patients through the full clinical intelligence pipeline</p>
        </div>
      )}

      {/* ═══ LIVE MONITOR GRID ═══ */}
      {(phase === 'REVEALING' || phase === 'DONE') && cards.length > 0 && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {cards.map((card, idx) => (
              <PatientCallCard
                key={card.result.patient_id}
                card={card}
                expanded={expandedCard === idx}
                onToggleExpand={() => setExpandedCard(expandedCard === idx ? null : idx)}
                voiceEnabled={voiceEnabled}
                batchLang={batchLang}
              />
            ))}
          </div>
        </div>
      )}

      {/* ═══ BOTTOM ACTION BAR ═══ */}
      {(phase === 'REVEALING' || phase === 'DONE') && (
        <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-t border-gray-700 shrink-0">
          {/* Batch summary */}
          {phase === 'DONE' && batchResult && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-400 font-medium">Batch {batchResult.batch_number} complete:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                {batchResult.completed} Completed
              </span>
              <span className="text-red-400 font-semibold flex items-center gap-1">
                <AlertOctagon className="h-4 w-4" />
                {batchResult.escalated} Escalated
              </span>
              {batchResult.escalated > 0 && (
                <Link href="/escalations" target="_blank"
                  className="text-xs bg-red-900/80 border border-red-700/80 text-red-200 px-3 py-1 rounded-lg flex items-center gap-1.5 hover:bg-red-800 transition-colors shadow-2xs">
                  Review Escalations <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}

          {phase === 'REVEALING' && (
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <PhoneCall className="h-4 w-4 animate-pulse" />
              <span>Batch {batchOffset + 1} running — {activeCount} calls active, {queuedCount} queued...</span>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {phase === 'REVEALING' && (
              <Button onClick={handleStop} variant="outline" size="sm"
                className="border-red-700 text-red-400 hover:bg-red-950 flex items-center gap-1">
                <Square className="h-3 w-3" /> Stop Batch
              </Button>
            )}

            {phase === 'DONE' && batchOffset + 1 < totalBatches && (
              <Button onClick={handleNextBatch}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2">
                <SkipForward className="h-4 w-4" />
                Next Batch ({batchOffset + 2} of {totalBatches}) — {Math.min(batchSize, totalPatients - (batchOffset + 1) * batchSize)} patients
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            {phase === 'DONE' && batchOffset + 1 >= totalBatches && (
              <div className="text-emerald-400 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                All {totalBatches} batches complete! All {totalPatients} patients contacted.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PATIENT CALL CARD ────────────────────────────────────────────────────────

function PatientCallCard({
  card,
  expanded,
  onToggleExpand,
  voiceEnabled,
  batchLang = 'en',
}: {
  card: PatientCardState;
  expanded: boolean;
  onToggleExpand: () => void;
  voiceEnabled: boolean;
  batchLang?: VoiceLanguage;
}) {
  const { result, status, visibleTurns, isSpeaking } = card;
  const scenario = scenarioBadge(result.scenario_type);
  const outcome  = outcomeBadge(result.call_outcome);

  const statusColors: Record<CallStatus, string> = {
    QUEUED:    'border-gray-700 bg-gray-900',
    DIALING:   'border-blue-700 bg-gray-900 animate-pulse',
    CONNECTED: 'border-blue-500 bg-gray-900',
    ESCALATED: 'border-red-500 bg-red-950/50',
    COMPLETED: 'border-emerald-600 bg-gray-900',
    FAILED:    'border-gray-600 bg-gray-900 opacity-60',
  };

  const displayConvo = result.conversation.slice(0, visibleTurns);

  return (
    <div className={`rounded-xl border-2 transition-all duration-300 flex flex-col ${statusColors[status]} ${expanded ? 'col-span-2' : ''}`}>
      {/* Card Header */}
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${scenario.cls}`}>
              {scenario.label}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-2xs font-semibold ${riskBadge(result.patient_risk_level)}`}>
              {result.patient_risk_level?.toUpperCase()}
            </span>
          </div>
          <div className="font-bold text-sm text-white truncate">{result.patient_name}</div>
          <div className="text-xs text-gray-400 truncate">{result.primary_diagnosis}</div>
          <div className="text-xs text-gray-500 font-mono">MRN: {result.mrn} · Age {result.age}</div>
        </div>

        {/* Status Indicator */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <StatusIndicator status={status} isSpeaking={isSpeaking && voiceEnabled} />
          <div className="text-xs text-gray-500 font-mono">{result.priority_score.toFixed(0)} pts</div>
        </div>
      </div>

      {/* Transcript Preview */}
      <div className="px-3 pb-2 flex-1">
        {status === 'QUEUED' && (
          <div className="text-xs text-gray-600 italic">Queued — waiting for dispatch...</div>
        )}
        {status === 'DIALING' && (
          <div className="text-xs text-blue-400 flex items-center gap-1">
            <PhoneCall className="h-3 w-3 animate-bounce" /> Dialing {result.patient_name}...
          </div>
        )}
        {(status === 'CONNECTED' || status === 'ESCALATED' || status === 'COMPLETED') && displayConvo.length > 0 && (
          <div className={`space-y-1 ${expanded ? 'max-h-64' : 'max-h-24'} overflow-y-auto`}>
            {displayConvo.map((msg, i) => {
              const isAI = msg.speaker === 'ai';
              const isCurrentTurn = i === visibleTurns - 1;
              const textContent = getClinicalTranslation(msg.message, batchLang);

              return (
                <div key={i} className={`text-xs rounded-lg px-2 py-1 ${
                  isAI
                    ? `bg-gray-800 text-gray-200 ${isCurrentTurn && isSpeaking ? 'border border-blue-500/60 shadow-sm shadow-blue-900/40' : ''}`
                    : 'bg-indigo-900/60 text-indigo-200'
                }`}>
                  <span className="font-bold text-2xs opacity-75 mr-1.5 inline-flex items-center gap-1">
                    {isAI ? (
                      <span className="flex items-center gap-1 inline-flex text-blue-300">
                        AI {isCurrentTurn && isSpeaking && voiceEnabled && (
                          <Volume2 className="h-2.5 w-2.5 text-blue-400 animate-pulse" />
                        )}
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5 inline-flex text-indigo-300">
                        <User className="h-2.5 w-2.5" /> Patient
                      </span>
                    )}
                  </span>
                  {textContent.slice(0, expanded ? 300 : 80)}{textContent.length > 80 && !expanded ? '...' : ''}
                </div>
              );
            })}
          </div>
        )}

        {/* Symptoms pills */}
        {(status === 'ESCALATED' || status === 'COMPLETED') && result.extracted_symptoms.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {result.extracted_symptoms.slice(0, expanded ? 10 : 2).map((s, i) => (
              <span key={i} className="bg-amber-900/60 text-amber-300 text-2xs px-1.5 py-0.5 rounded border border-amber-700/50">
                {s}
              </span>
            ))}
            {!expanded && result.extracted_symptoms.length > 2 && (
              <span className="text-gray-500 text-2xs">+{result.extracted_symptoms.length - 2} more</span>
            )}
          </div>
        )}
      </div>

      {/* Card Footer */}
      {(status === 'ESCALATED' || status === 'COMPLETED') && (
        <div className="px-3 pb-2 flex items-center justify-between gap-2 border-t border-gray-800 pt-2">
          <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${outcome.cls}`}>
            {outcome.label}
          </span>
          <button
            onClick={onToggleExpand}
            className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-0.5"
          >
            {expanded ? 'Collapse' : 'Expand'} <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── STATUS INDICATOR ─────────────────────────────────────────────────────────

function StatusIndicator({ status, isSpeaking }: { status: CallStatus; isSpeaking: boolean }) {
  const map: Record<CallStatus, { label: string; cls: string }> = {
    QUEUED:    { label: 'Queued',    cls: 'bg-gray-700 text-gray-400' },
    DIALING:   { label: 'Dialing',   cls: 'bg-blue-600 text-white animate-pulse' },
    CONNECTED: { label: 'Live',      cls: 'bg-green-600 text-white' },
    ESCALATED: { label: 'Escalated', cls: 'bg-red-600 text-white' },
    COMPLETED: { label: 'Done',      cls: 'bg-emerald-700 text-white' },
    FAILED:    { label: 'Failed',    cls: 'bg-gray-700 text-gray-500' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${cls} flex items-center gap-1`}>
      {status === 'CONNECTED' && isSpeaking && (
        <span className="flex gap-0.5">
          <span className="w-0.5 h-2 bg-white rounded animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-0.5 h-2 bg-white rounded animate-bounce" style={{ animationDelay: '100ms' }} />
          <span className="w-0.5 h-2 bg-white rounded animate-bounce" style={{ animationDelay: '200ms' }} />
        </span>
      )}
      {label}
    </span>
  );
}

// ─── STAT PILL ────────────────────────────────────────────────────────────────

function StatPill({ label, value, color, icon, pulse }: {
  label: string; value: number; color: string; icon: React.ReactNode; pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`${color} ${pulse && value > 0 ? 'animate-pulse' : ''}`}>{icon}</span>
      <span className="text-gray-500">{label}:</span>
      <span className={`font-bold font-mono ${color}`}>{value}</span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
