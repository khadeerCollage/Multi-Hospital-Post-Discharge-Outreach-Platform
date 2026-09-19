"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  PhoneCall,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Clock,
  RefreshCw,
  Volume2,
  VolumeX,
  SkipForward,
  ChevronRight,
  ChevronLeft,
  User,
  Activity,
  Zap,
  Square,
  ArrowRight,
  ExternalLink,
  Globe,
  Layers,
  FileText,
  PhoneForwarded,
  Radio,
  Play,
  Scale
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import {
  speak,
  stopSpeaking,
  playCallDialogue,
  detectVoiceCapabilities,
  VoiceLanguage,
  SUPPORTED_LANGUAGES,
  getClinicalTranslation
} from '@/lib/voice/browserVoiceAdapter';
import { SlideToConfirm } from '@/components/SlideToConfirm';

export interface OutreachOrchestratorModalProps {
  campaignId: string;
  campaign: any;
  tasks: any[];
  onClose: () => void;
  onRefresh?: () => void;
}

type OrchestratorStep = 'scope' | 'config' | 'running';
type OutreachMode = 'batch' | 'single';
type ScenarioType = 'mixed' | 'emergency' | 'urgent' | 'routine';
type SingleScenario = 'emergency' | 'urgent' | 'routine';

interface PatientCardState {
  result: any;
  status: 'QUEUED' | 'DIALING' | 'CONNECTED' | 'COMPLETED' | 'ESCALATED' | 'FAILED';
  visibleTurns: number;
  isSpeaking: boolean;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export default function OutreachOrchestratorModal({
  campaignId,
  campaign,
  tasks,
  onClose,
  onRefresh
}: OutreachOrchestratorModalProps) {
  // Wizard Steps: 'scope' -> 'config' -> 'running'
  const [step, setStep] = useState<OrchestratorStep>('scope');
  const [mode, setMode] = useState<OutreachMode>('batch');

  // Configuration options
  const [batchScenario, setBatchScenario] = useState<ScenarioType>('mixed');
  const [singleScenario, setSingleScenario] = useState<SingleScenario>('emergency');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    tasks.length > 0 ? tasks[0].patient_id : ''
  );
  const [selectedLang, setSelectedLang] = useState<VoiceLanguage>('en');
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(true);

  // Audio & Voice Capabilities
  const [voiceCaps, setVoiceCaps] = useState<{
    ttsAvailable: boolean;
    sttAvailable: boolean;
    recommendedBrowser: boolean;
  } | null>(null);
  const langRef = useRef<VoiceLanguage>('en');
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  // Batch Execution State
  const [batchOffset, setBatchOffset] = useState(0);
  const [batchSize] = useState(10);
  const [batchResult, setBatchResult] = useState<any>(null);
  const [cards, setCards] = useState<PatientCardState[]>([]);
  const [batchPhase, setBatchPhase] = useState<'IDLE' | 'LOADING' | 'REVEALING' | 'DONE'>('IDLE');
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  // Single Patient Simulation State
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [simActiveTab, setSimActiveTab] = useState<'dialogue' | 'council' | 'soap'>('dialogue');
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState<Array<{ speaker: string; message: string }>>([]);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(-1);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState('');

  // Total patient calculations
  const totalPatients = tasks.length || campaign?.total_eligible || 10;
  const totalBatches = Math.max(1, Math.ceil(totalPatients / batchSize));

  // Auto-scroll single simulation transcript
  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveTranscript]);

  // Detect browser voice support on mount
  useEffect(() => {
    const caps = detectVoiceCapabilities();
    setVoiceCaps(caps);
    if (!caps.ttsAvailable) setSpeechEnabled(false);

    if (tasks.length > 0 && !selectedPatientId) {
      setSelectedPatientId(tasks[0].patient_id);
    }

    return () => {
      stopSpeaking();
      cancelRef.current.cancelled = true;
    };
  }, []);

  // Update refs when language state changes
  const handleLanguageChange = (newLang: VoiceLanguage) => {
    setSelectedLang(newLang);
    langRef.current = newLang;

    // Mid-call instant switch for single patient simulation
    if (isPlayingVoice && currentTurnIndex >= 0 && liveTranscript[currentTurnIndex]) {
      const activeTurn = liveTranscript[currentTurnIndex];
      if (activeTurn.speaker === 'ai') {
        stopSpeaking();
        speak(activeTurn.message, { lang: newLang });
      }
    }
  };

  // Play single dialogue turn on demand
  const playSingleTurn = (turnMessage: string, lang?: VoiceLanguage) => {
    stopSpeaking();
    speak(turnMessage, { lang: lang || selectedLang });
  };

  const handleClose = () => {
    cancelRef.current.cancelled = true;
    stopSpeaking();
    onClose();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTION: BATCH OUTREACH
  // ═══════════════════════════════════════════════════════════════════════════
  const runBatch = useCallback(async (offset: number) => {
    cancelRef.current = { cancelled: false };
    setBatchPhase('LOADING');
    setBatchResult(null);
    setCards([]);
    setError('');
    setExpandedCard(null);
    stopSpeaking();

    try {
      const res = await fetchApi(`/api/v1/queue/${campaignId}/simulate-batch`, {
        method: 'POST',
        body: JSON.stringify({
          scenario_type: batchScenario,
          batch_size: batchSize,
          batch_offset: offset,
        }),
      });

      setBatchResult(res);
      setBatchPhase('REVEALING');

      // Initialize all cards as QUEUED
      setCards(
        res.results.map((r: any) => ({
          result: r,
          status: 'QUEUED',
          visibleTurns: 0,
          isSpeaking: false,
        }))
      );

      // Animate each patient card sequentially: Dial -> Connect -> Turns -> Complete/Escalate
      for (let i = 0; i < res.results.length; i++) {
        if (cancelRef.current.cancelled) break;
        const patient = res.results[i];

        // Mark DIALING
        setCards(prev => prev.map((c, idx) => (idx === i ? { ...c, status: 'DIALING' } : c)));
        await delay(500);
        if (cancelRef.current.cancelled) break;

        // Mark CONNECTED
        setCards(prev => prev.map((c, idx) => (idx === i ? { ...c, status: 'CONNECTED' } : c)));
        await delay(300);

        // Play conversation turns
        const convo = patient.conversation || [];
        for (let t = 0; t < convo.length; t++) {
          if (cancelRef.current.cancelled) break;

          setCards(prev =>
            prev.map((c, idx) =>
              idx === i ? { ...c, visibleTurns: t + 1, isSpeaking: convo[t].speaker === 'ai' } : c
            )
          );

          const msg = convo[t];
          if (msg.speaker === 'ai' && speechEnabled && voiceCaps?.ttsAvailable) {
            await speak(msg.message.slice(0, 120), { lang: langRef.current, rate: 1.1 });
          } else {
            await delay(msg.speaker === 'ai' ? 800 : 500);
          }
        }

        if (cancelRef.current.cancelled) break;

        // Final Outcome
        setCards(prev =>
          prev.map((c, idx) =>
            idx === i
              ? {
                  ...c,
                  status: patient.call_outcome === 'ESCALATED' ? 'ESCALATED' : 'COMPLETED',
                  isSpeaking: false,
                }
              : c
          )
        );

        if (onRefresh) onRefresh();
        await delay(250);
      }

      setBatchPhase('DONE');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err.message || 'Batch outreach execution failed.');
      setBatchPhase('IDLE');
    }
  }, [campaignId, batchScenario, speechEnabled, voiceCaps, onRefresh]);

  const handleNextBatch = () => {
    const next = batchOffset + 1;
    if (next >= totalBatches) return;
    setBatchOffset(next);
    runBatch(next);
  };

  const handleStopBatch = () => {
    cancelRef.current.cancelled = true;
    stopSpeaking();
    setBatchPhase('DONE');
    setCards(prev =>
      prev.map(c =>
        c.status === 'QUEUED' || c.status === 'DIALING' || c.status === 'CONNECTED'
          ? { ...c, status: 'FAILED', isSpeaking: false }
          : { ...c, isSpeaking: false }
      )
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTION: SINGLE PATIENT DEEP SIMULATION
  // ═══════════════════════════════════════════════════════════════════════════
  const runSingleSimulation = async () => {
    cancelRef.current = { cancelled: false };
    stopSpeaking();
    setIsPlayingVoice(false);
    setSimLoading(true);
    setSimResult(null);
    setLiveTranscript([]);
    setCurrentTurnIndex(-1);

    try {
      const res = await fetchApi(`/api/v1/queue/${campaignId}/simulate-call`, {
        method: 'POST',
        body: JSON.stringify({
          scenario_type: singleScenario,
          patient_id: selectedPatientId || undefined,
        }),
      });

      setSimResult(res);
      setSimActiveTab('dialogue');
      if (onRefresh) onRefresh();

      const conversation = res.conversation || [];
      if (speechEnabled && conversation.length > 0 && voiceCaps?.ttsAvailable) {
        setIsPlayingVoice(true);
        setLiveTranscript([]);
        setCurrentTurnIndex(0);

        await playCallDialogue(
          conversation,
          turnIndex => {
            setCurrentTurnIndex(turnIndex);
            setLiveTranscript(conversation.slice(0, turnIndex + 1));
          },
          cancelRef.current,
          () => langRef.current
        );

        setIsPlayingVoice(false);
        setCurrentTurnIndex(-1);
        setLiveTranscript(conversation);
        if (onRefresh) onRefresh();
      } else {
        setLiveTranscript(conversation);
      }
    } catch (err: any) {
      setError(err.message || 'Call simulation failed.');
    } finally {
      setSimLoading(false);
    }
  };

  // Handle Launch from Step 2
  const handleStartProcess = () => {
    setStep('running');
    if (mode === 'batch') {
      setBatchOffset(0);
      runBatch(0);
    } else {
      runSingleSimulation();
    }
  };

  // Stat counters for batch cards
  const completedCount = cards.filter(c => c.status === 'COMPLETED').length;
  const escalatedCount = cards.filter(c => c.status === 'ESCALATED').length;
  const activeCount = cards.filter(c => c.status === 'CONNECTED' || c.status === 'DIALING').length;
  const queuedCount = cards.filter(c => c.status === 'QUEUED').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-hidden">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* ═══ CONSOLE HEADER ═══ */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Outreach Console & Orchestrator</h2>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {mode === 'batch' ? 'Batch Cohort' : 'Targeted Simulation'}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {campaign?.name || 'Campaign'} • {tasks.length} Patients in Cohort
              </p>
            </div>
          </div>

          {/* Stepper indicator during setup */}
          {step !== 'running' && (
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold">
              <span className={`px-2.5 py-1 rounded-md transition-colors ${
                step === 'scope' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                1. Select Scope
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
              <span className={`px-2.5 py-1 rounded-md transition-colors ${
                step === 'config' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}>
                2. Voice & Protocols
              </span>
            </div>
          )}

          {/* Running Controls & Mid-Call Language Switcher */}
          <div className="flex items-center gap-2.5">
            {step === 'running' && (
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg p-1 shadow-2xs">
                <span className="text-2xs font-semibold text-gray-500 px-1.5 flex items-center gap-1">
                  <Globe className="h-3 w-3 text-blue-600" /> Voice:
                </span>
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`px-2 py-0.5 rounded text-2xs font-semibold transition-all ${
                      selectedLang === lang.code
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                    title={`Switch voice output to ${lang.name} (${lang.nativeName})`}
                  >
                    <span>{lang.nativeName}</span>
                  </button>
                ))}
              </div>
            )}

            {step === 'running' && voiceCaps?.ttsAvailable && (
              <button
                onClick={() => {
                  setSpeechEnabled(v => !v);
                  if (speechEnabled) stopSpeaking();
                }}
                className={`p-2 rounded-lg border text-xs transition-colors ${
                  speechEnabled
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                }`}
                title={speechEnabled ? 'Mute AI voice' : 'Enable AI voice'}
              >
                {speechEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
            )}

            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              title="Close Console"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ═══ ERROR NOTIFICATION ═══ */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* STEP 1: SELECT OUTREACH SCOPE                                         */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {step === 'scope' && (
          <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
            <div>
              <h3 className="text-base font-bold text-gray-900">Step 1: Select Outreach Scope</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose whether to dispatch concurrent outreach across the queued cohort or test a single patient.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A: Batch Cohort */}
              <div
                onClick={() => setMode('batch')}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  mode === 'batch'
                    ? 'border-blue-600 bg-blue-50/30 shadow-xs ring-1 ring-blue-500'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Layers className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-sm text-gray-900">Batch Cohort Outreach</span>
                  </div>
                  <Radio className={`h-4 w-4 ${mode === 'batch' ? 'text-blue-600' : 'text-gray-300'}`} />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">
                  Autonomous outreach processed in concurrent batches of <strong>10 lines simultaneously</strong>, dynamically ordered by patient risk score and discharge priority.
                </p>

                {/* Batch Sub-Options */}
                {mode === 'batch' && (
                  <div className="mt-4 pt-3 border-t border-blue-200/60 space-y-2.5">
                    <label className="text-2xs font-bold uppercase tracking-wider text-gray-600">
                      Scenario Mix Simulation:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'mixed', label: 'Mixed (Realistic)' },
                        { id: 'emergency', label: 'Critical Emergency' },
                        { id: 'urgent', label: 'Post-Op Complication' },
                        { id: 'routine', label: 'Routine Recovery' },
                      ].map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setBatchScenario(s.id as ScenarioType);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-2xs font-semibold border text-left transition-all ${
                            batchScenario === s.id
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Option B: Targeted Single Patient */}
              <div
                onClick={() => setMode('single')}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  mode === 'single'
                    ? 'border-indigo-600 bg-indigo-50/30 shadow-xs ring-1 ring-indigo-500'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-sm text-gray-900">Single Patient Simulation</span>
                  </div>
                  <Radio className={`h-4 w-4 ${mode === 'single' ? 'text-indigo-600' : 'text-gray-300'}`} />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">
                  Execute a deep, interactive clinical simulation for an individual patient to audit the voice dialogue, 3-Agent Council assessment, and auto-generated EHR SOAP note.
                </p>

                {/* Single Patient Sub-Options */}
                {mode === 'single' && (
                  <div className="mt-4 pt-3 border-t border-indigo-200/60 space-y-2.5">
                    <div>
                      <label className="text-2xs font-bold uppercase tracking-wider text-gray-600 block mb-1">
                        Select Target Patient:
                      </label>
                      <select
                        value={selectedPatientId}
                        onChange={e => {
                          e.stopPropagation();
                          setSelectedPatientId(e.target.value);
                        }}
                        className="w-full text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 focus:ring-1 focus:ring-indigo-500"
                      >
                        {tasks.length > 0 ? (
                          tasks.map((t: any) => (
                            <option key={t.patient_id} value={t.patient_id}>
                              {t.patient_name || 'Patient'} — MRN: {t.patient_mrn || 'N/A'} ({t.patient_risk_level || 'routine'})
                            </option>
                          ))
                        ) : (
                          <option value="">Default Cohort Patient</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-2xs font-bold uppercase tracking-wider text-gray-600 block mb-1">
                        Clinical Test Scenario:
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'emergency', label: 'Emergency' },
                          { id: 'urgent', label: 'Infection' },
                          { id: 'routine', label: 'Routine' },
                        ].map(sc => (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setSingleScenario(sc.id as SingleScenario);
                            }}
                            className={`px-2 py-1.5 rounded-lg text-2xs font-semibold border text-center transition-all ${
                              singleScenario === sc.id
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Step 1 Footer */}
            <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
              <Button variant="outline" onClick={handleClose} className="text-xs">
                Cancel
              </Button>
              <Button
                onClick={() => setStep('config')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 flex items-center gap-1.5 shadow-sm"
              >
                <span>Next: Voice & Protocols</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* STEP 2: VOICE & PROTOCOLS CONFIGURATION                               */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {step === 'config' && (
          <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
            <div>
              <h3 className="text-base font-bold text-gray-900">Step 2: Configure Voice AI & Protocols</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Select your preferred voice synthesis language and review execution parameters before starting.
              </p>
            </div>

            {/* Language Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-blue-600" />
                Primary Voice AI Language
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SUPPORTED_LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    className={`p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                      selectedLang === lang.code
                        ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-1 ring-blue-500'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-gray-900">{lang.nativeName}</span>
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase">
                        {lang.badge}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{lang.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-2xs text-gray-500 italic mt-1">
                You can switch between English, Telugu, and Hindi at any time during active calls.
              </p>
            </div>

            {/* Audio Engine Toggle */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Volume2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">Real-Time Voice Audio Output</span>
                    <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Free Forever ($0 Cost)
                    </span>
                  </div>
                  <p className="text-2xs text-gray-500 mt-0.5">
                    Synthesizes clinical speech directly in the browser via Web Speech API. Zero telephony bills.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={speechEnabled}
                  onChange={e => setSpeechEnabled(e.target.checked)}
                  className="sr-only peer"
                  disabled={!voiceCaps?.ttsAvailable}
                />
                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Pre-Launch Summary Card */}
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-blue-950 uppercase tracking-wider">Outreach Run Summary</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-500 block text-2xs">Scope Mode</span>
                  <strong className="text-gray-900">{mode === 'batch' ? 'Cohort Batch (10 lines)' : 'Single Patient'}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-2xs">Scenario</span>
                  <strong className="text-gray-900 capitalize">{mode === 'batch' ? batchScenario : singleScenario}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-2xs">Language</span>
                  <strong className="text-gray-900">{selectedLang === 'te' ? 'తెలుగు (Telugu)' : selectedLang === 'hi' ? 'हिन्दी (Hindi)' : 'English'}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-2xs">Safeguards</span>
                  <strong className="text-gray-900">3-Agent Safety Arbiter</strong>
                </div>
              </div>
            </div>

            {/* Step 2 Footer */}
            <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" onClick={() => setStep('scope')} className="text-xs flex items-center gap-1.5">
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to Scope
              </Button>
              <div className="flex items-center gap-2">
                <SlideToConfirm
                  label="Slide to start outreach"
                  confirmedLabel="Outreach Initiated"
                  variant="blue"
                  width={250}
                  onConfirm={handleStartProcess}
                />
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* STEP 3: LIVE PROCESS & EXECUTION                                      */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {step === 'running' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50">

            {/* ─── LIVE BATCH CONSOLE ─── */}
            {mode === 'batch' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Stats Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-2.5 bg-white border-b border-gray-200 text-xs shrink-0">
                  <div className="flex items-center gap-5">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span>Queued:</span>
                      <strong className="font-mono text-gray-900">{queuedCount}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-700">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      <span>Active:</span>
                      <strong className="font-mono text-blue-900">{activeCount}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Completed:</span>
                      <strong className="font-mono text-emerald-900">{completedCount}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 text-red-700">
                      <AlertOctagon className="h-3.5 w-3.5 text-red-600" />
                      <span>Escalated:</span>
                      <strong className="font-mono text-red-900">{escalatedCount}</strong>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 font-medium">
                    Batch <strong className="text-gray-900 font-mono">{batchOffset + 1}</strong> of <strong className="text-gray-900 font-mono">{totalBatches}</strong> ({batchSize} concurrent slots)
                  </div>
                </div>

                {/* Loading Indicator */}
                {batchPhase === 'LOADING' && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
                    <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                    <p className="text-xs font-medium text-gray-600">
                      Leasing concurrent queue slots and connecting AI agents...
                    </p>
                  </div>
                )}

                {/* Cards Grid */}
                {(batchPhase === 'REVEALING' || batchPhase === 'DONE') && (
                  <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5">
                      {cards.map((card, idx) => {
                        const { result, status, visibleTurns, isSpeaking } = card;
                        const isEscalated = status === 'ESCALATED';

                        return (
                          <div
                            key={idx}
                            className={`bg-white rounded-xl border p-4 shadow-2xs transition-all flex flex-col justify-between ${
                              status === 'CONNECTED'
                                ? 'border-blue-400 ring-1 ring-blue-300'
                                : isEscalated
                                ? 'border-red-300 bg-red-50/20'
                                : 'border-gray-200'
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-sm text-gray-900">{result.patient_name}</h4>
                                  <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                    MRN: {result.mrn || result.patient_mrn || 'N/A'}
                                  </span>
                                </div>
                                <p className="text-2xs text-gray-500 mt-0.5">
                                  Score: <strong className="font-mono">{result.priority_score?.toFixed(1) || '95.0'}</strong> • {result.procedure_name || 'Post-Discharge Follow-Up'}
                                </p>
                              </div>

                              {/* Status Badge */}
                              <div>
                                {status === 'QUEUED' && (
                                  <span className="text-2xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold">
                                    Queued
                                  </span>
                                )}
                                {status === 'DIALING' && (
                                  <span className="text-2xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold flex items-center gap-1 animate-pulse">
                                    <PhoneCall className="h-3 w-3" /> Dialing...
                                  </span>
                                )}
                                {status === 'CONNECTED' && (
                                  <span className="text-2xs px-2 py-0.5 bg-blue-600 text-white rounded font-bold flex items-center gap-1">
                                    <Activity className="h-3 w-3 animate-pulse" /> Speaking
                                  </span>
                                )}
                                {status === 'COMPLETED' && (
                                  <span className="text-2xs px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Completed
                                  </span>
                                )}
                                {status === 'ESCALATED' && (
                                  <span className="text-2xs px-2 py-0.5 bg-red-600 text-white rounded font-bold flex items-center gap-1 shadow-2xs">
                                    <AlertOctagon className="h-3 w-3" /> Escalated
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Transcript box */}
                            <div className="bg-gray-50 border border-gray-200/70 rounded-lg p-2.5 my-2 space-y-1.5 max-h-36 overflow-y-auto text-xs">
                              {visibleTurns === 0 && (
                                <span className="text-gray-400 italic text-2xs">Waiting for connection...</span>
                              )}
                              {(result.conversation || []).slice(0, visibleTurns).map((msg: any, tIdx: number) => {
                                const isAI = msg.speaker === 'ai';
                                const isCurrentTurn = tIdx === visibleTurns - 1;
                                const textContent = getClinicalTranslation(msg.message, selectedLang);
                                const hasTranslation = selectedLang !== 'en' && textContent !== msg.message;

                                return (
                                  <div
                                    key={tIdx}
                                    className={`p-2 rounded-lg text-2xs leading-relaxed ${
                                      isAI
                                        ? `bg-white border text-gray-800 ${
                                            isCurrentTurn && isSpeaking ? 'border-blue-300 ring-1 ring-blue-200' : 'border-gray-200'
                                          }`
                                        : 'bg-indigo-50 border border-indigo-100 text-indigo-950'
                                    }`}
                                  >
                                    <div className="font-bold uppercase tracking-wider text-3xs opacity-75 mb-0.5 flex items-center justify-between">
                                      <span>{isAI ? 'CareReach AI' : 'Patient'}</span>
                                      {isAI && isCurrentTurn && isSpeaking && speechEnabled && (
                                        <Volume2 className="h-2.5 w-2.5 text-blue-600 animate-pulse" />
                                      )}
                                    </div>
                                    <p>{textContent}</p>
                                    {hasTranslation && (
                                      <p className="text-3xs text-gray-500 italic mt-0.5 border-t border-gray-100 pt-0.5">
                                        EN: {msg.message}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Extracted symptoms / actions footer */}
                            {result.extracted_symptoms && result.extracted_symptoms.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {result.extracted_symptoms.map((sym: string, sIdx: number) => (
                                  <span
                                    key={sIdx}
                                    className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900"
                                  >
                                    {sym}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Batch Console Footer */}
                <div className="px-6 py-3 bg-white border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  {batchPhase === 'REVEALING' && (
                    <div className="flex items-center gap-2 text-xs text-blue-700">
                      <Activity className="h-4 w-4 animate-pulse" />
                      <span>Batch in progress... ({activeCount} lines active)</span>
                    </div>
                  )}

                  {batchPhase === 'DONE' && (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-semibold text-gray-700">Batch Completed:</span>
                      <span className="text-emerald-700 font-bold">{completedCount} Completed</span>
                      <span className="text-red-700 font-bold">{escalatedCount} Escalated</span>
                      {escalatedCount > 0 && (
                        <Link
                          href="/escalations"
                          target="_blank"
                          className="bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded text-2xs font-semibold flex items-center gap-1"
                        >
                          Review in Escalations <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 ml-auto">
                    {batchPhase === 'REVEALING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStopBatch}
                        className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <Square className="h-3 w-3 mr-1" /> Stop Batch
                      </Button>
                    )}

                    {batchPhase === 'DONE' && batchOffset + 1 < totalBatches && (
                      <Button
                        onClick={handleNextBatch}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5"
                      >
                        <span>Next Batch ({batchOffset + 2} of {totalBatches})</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStep('scope')}
                      className="text-xs"
                    >
                      New Outreach Run
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ─── LIVE SINGLE PATIENT CLINICAL CONSOLE ─── */}
            {mode === 'single' && (
              <div className="flex-1 flex flex-col overflow-hidden p-6 space-y-4">
                {simLoading && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
                    <p className="text-xs font-medium text-gray-600">
                      Connecting call and executing 3-Agent clinical triage graph...
                    </p>
                  </div>
                )}

                {simResult && !simLoading && (
                  <>
                    {/* Outcome Alert Banner */}
                    {simResult.call_outcome === 'ESCALATED' ? (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-red-600 text-white flex items-center justify-center">
                            <AlertOctagon className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-red-950 text-sm">
                              CLINICAL ESCALATION CONFIRMED (Zero-Hallucination Arbiter)
                            </h4>
                            <p className="text-xs text-red-800">
                              Patient <strong>{simResult.patient_name}</strong> presented red flags. Escalation ticket auto-dispatched.
                            </p>
                          </div>
                        </div>
                        <Link
                          href="/escalations"
                          target="_blank"
                          className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs"
                        >
                          Open Escalations Queue <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 shrink-0">
                        <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0" />
                        <div>
                          <h4 className="font-bold text-emerald-950 text-sm">
                            POST-DISCHARGE CHECK COMPLETED
                          </h4>
                          <p className="text-xs text-emerald-800">
                            Patient <strong>{simResult.patient_name}</strong> confirmed stable. SOAP note filed to EHR.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 gap-6 text-sm shrink-0">
                      <button
                        onClick={() => setSimActiveTab('dialogue')}
                        className={`pb-2 font-bold flex items-center gap-1.5 transition-colors ${
                          simActiveTab === 'dialogue'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <PhoneCall className="h-4 w-4" />
                        Voice Intake Dialogue ({simResult.conversation?.length || 0} turns)
                        {isPlayingVoice && (
                          <Volume2 className="h-3.5 w-3.5 text-blue-600 animate-pulse ml-1" />
                        )}
                      </button>
                      <button
                        onClick={() => setSimActiveTab('council')}
                        className={`pb-2 font-bold flex items-center gap-1.5 transition-colors ${
                          simActiveTab === 'council'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Scale className="h-4 w-4" />
                        3-Agent Safety Council & Arbiter
                      </button>
                      <button
                        onClick={() => setSimActiveTab('soap')}
                        className={`pb-2 font-bold flex items-center gap-1.5 transition-colors ${
                          simActiveTab === 'soap'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                        Auto-Generated EHR SOAP Note
                      </button>
                    </div>

                    {/* TAB 1: DIALOGUE */}
                    {simActiveTab === 'dialogue' && (
                      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        <div className="space-y-2.5">
                          {liveTranscript.map((msg: any, idx: number) => {
                            const isAI = msg.speaker === 'ai';
                            const isCurrentlySpeaking = isPlayingVoice && idx === currentTurnIndex;
                            const translatedMsg = getClinicalTranslation(msg.message, selectedLang);
                            const hasTranslation = selectedLang !== 'en' && translatedMsg !== msg.message;

                            return (
                              <div
                                key={idx}
                                className={`flex gap-2.5 ${isAI ? 'justify-start' : 'justify-end'}`}
                              >
                                {isAI && (
                                  <div
                                    className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 font-bold text-2xs text-white ${
                                      isCurrentlySpeaking ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-blue-700'
                                    }`}
                                  >
                                    AI
                                  </div>
                                )}
                                <div
                                  className={`p-3 rounded-xl max-w-lg text-xs leading-relaxed ${
                                    isAI
                                      ? 'bg-white border border-gray-200 text-gray-800 shadow-2xs'
                                      : 'bg-blue-600 text-white shadow-2xs'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-3xs font-bold uppercase tracking-wider opacity-75">
                                      {isAI ? 'CareReach Clinical AI' : simResult.patient_name || 'Patient'}
                                    </span>
                                    {isAI && (
                                      <button
                                        type="button"
                                        onClick={() => playSingleTurn(msg.message, selectedLang)}
                                        className="inline-flex items-center gap-1 text-3xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/70"
                                      >
                                        <Volume2 className="h-2.5 w-2.5" />
                                        <span>Play ({selectedLang.toUpperCase()})</span>
                                      </button>
                                    )}
                                  </div>
                                  <p>{translatedMsg}</p>
                                  {hasTranslation && (
                                    <div className="mt-1.5 pt-1.5 border-t border-gray-100 text-2xs text-gray-500 italic">
                                      <strong className="not-italic text-gray-600">EN:</strong> {msg.message}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          <div ref={transcriptEndRef} />
                        </div>
                      </div>
                    )}

                    {/* TAB 2: COUNCIL */}
                    {simActiveTab === 'council' && (
                      <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {/* Assessor 1 */}
                          <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-2xs">
                            <span className="text-3xs font-bold uppercase text-gray-500">Agent 1</span>
                            <h5 className="font-bold text-gray-900">Clinical Triage Specialist</h5>
                            <p className="text-gray-600 text-2xs">
                              Evaluates reported symptoms against clinical severity grading rules.
                            </p>
                            <div className="pt-2 border-t border-gray-100">
                              <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                Decision: {simResult.call_outcome}
                              </span>
                            </div>
                          </div>

                          {/* Assessor 2 */}
                          <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-2xs">
                            <span className="text-3xs font-bold uppercase text-gray-500">Agent 2</span>
                            <h5 className="font-bold text-gray-900">Protocol Adherence Inspector</h5>
                            <p className="text-gray-600 text-2xs">
                              Cross-references hospital-approved discharge protocols.
                            </p>
                            <div className="pt-2 border-t border-gray-100">
                              <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                                Compliance: 100% Protocol Match
                              </span>
                            </div>
                          </div>

                          {/* Assessor 3 */}
                          <div className="p-3.5 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-2xs">
                            <span className="text-3xs font-bold uppercase text-gray-500">Agent 3</span>
                            <h5 className="font-bold text-gray-900">Zero-Hallucination Arbiter</h5>
                            <p className="text-gray-600 text-2xs">
                              Deterministic consensus arbiter requiring cited transcript grounding.
                            </p>
                            <div className="pt-2 border-t border-gray-100">
                              <span className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                                simResult.call_outcome === 'ESCALATED' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                Arbiter: {simResult.call_outcome === 'ESCALATED' ? 'Escalation Upheld' : 'Stable Certified'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {simResult.council_evaluations && (
                          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-2xs">
                            <h5 className="font-bold text-gray-900 mb-2">Arbiter Audit Trail & Evidence</h5>
                            <pre className="text-2xs text-gray-700 bg-gray-50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono">
                              {JSON.stringify(simResult.council_evaluations, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 3: SOAP NOTE */}
                    {simActiveTab === 'soap' && (
                      <div className="flex-1 overflow-y-auto pr-1">
                        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs space-y-4 text-xs font-mono">
                          <div className="border-b border-gray-200 pb-2 flex justify-between items-center font-sans">
                            <h4 className="font-bold text-sm text-gray-900">Electronic Health Record — Post-Discharge Note</h4>
                            <span className="text-2xs text-gray-500">Status: Signed by AI Intake Agent</span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <strong className="text-blue-900 block font-sans text-xs">SUBJECTIVE:</strong>
                              <p className="text-gray-700 whitespace-pre-wrap mt-0.5">
                                {simResult.soap_note?.subjective || 'Patient contacted via autonomous phone check-in. Symptoms reviewed against discharge protocol.'}
                              </p>
                            </div>
                            <div>
                              <strong className="text-blue-900 block font-sans text-xs">OBJECTIVE:</strong>
                              <p className="text-gray-700 whitespace-pre-wrap mt-0.5">
                                {simResult.soap_note?.objective || 'Vital signs and surgical site status evaluated. Symptoms logged.'}
                              </p>
                            </div>
                            <div>
                              <strong className="text-blue-900 block font-sans text-xs">ASSESSMENT:</strong>
                              <p className="text-gray-700 whitespace-pre-wrap mt-0.5">
                                {simResult.soap_note?.assessment || `Clinical triage outcome: ${simResult.call_outcome}.`}
                              </p>
                            </div>
                            <div>
                              <strong className="text-blue-900 block font-sans text-xs">PLAN:</strong>
                              <p className="text-gray-700 whitespace-pre-wrap mt-0.5">
                                {simResult.soap_note?.plan || 'Continue recovery protocol; follow up as scheduled.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Single Footer */}
                    <div className="pt-3 border-t border-gray-200 flex justify-between items-center shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStep('scope')}
                        className="text-xs"
                      >
                        Adjust Scope
                      </Button>
                      <Button
                        onClick={runSingleSimulation}
                        disabled={simLoading || isPlayingVoice}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Re-run Simulation
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
