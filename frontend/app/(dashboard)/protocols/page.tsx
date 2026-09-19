'use client';
import { useState, useEffect } from 'react';
import { 
  ClipboardList, AlertCircle, ShieldAlert, CheckCircle2, 
  Edit3, Plus, Trash2, X, Sparkles, Building2, Clock, 
  Check, Info, RefreshCw
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import Loader from '@/components/ui/loader';

interface Protocol {
  id: string;
  tenant_id: string;
  name: string;
  condition_type: string;
  description?: string;
  follow_up_questions: string[];
  red_flag_symptoms: string[];
  escalation_indicators?: string[];
  approved_guidance?: any;
  contact_window_hours: number;
  priority_level: string;
  is_active: boolean;
  version: string;
  hospital_name?: string;
}

export default function ProtocolsPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Editing state
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null);
  const [isNewProtocol, setIsNewProtocol] = useState(false);
  const [formName, setFormName] = useState('');
  const [formCondition, setFormCondition] = useState('');
  const [formWindow, setFormWindow] = useState(72);
  const [formQuestions, setFormQuestions] = useState<string[]>([]);
  const [formRedFlags, setFormRedFlags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchProtocols = async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/api/v1/protocols');
      setProtocols(data.items || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load clinical protocols');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProtocols();
  }, []);

  const openEditModal = (p: Protocol) => {
    setEditingProtocol(p);
    setIsNewProtocol(false);
    setFormName(p.name);
    setFormCondition(p.condition_type);
    setFormWindow(p.contact_window_hours || 72);
    setFormQuestions([...(p.follow_up_questions || [])]);
    setFormRedFlags([...(p.red_flag_symptoms || [])]);
  };

  const openCreateModal = () => {
    setEditingProtocol(null);
    setIsNewProtocol(true);
    setFormName('');
    setFormCondition('General Surgery');
    setFormWindow(72);
    setFormQuestions([
      'How are you feeling since your discharge?',
      'Are you experiencing any pain? How severe on a scale of 1-10?',
      'Have you noticed any redness, swelling, or drainage at surgical site?',
      'Are you taking all your prescribed medications as directed?'
    ]);
    setFormRedFlags([
      'Fever over 101°F (38.3°C)',
      'Severe or worsening pain not controlled by medication',
      'Redness, swelling, or pus drainage at surgical incision',
      'Difficulty breathing or sudden shortness of breath'
    ]);
  };

  const closeModal = () => {
    setEditingProtocol(null);
    setIsNewProtocol(false);
    setSaving(false);
  };

  // Question helpers
  const handleQuestionChange = (index: number, val: string) => {
    const updated = [...formQuestions];
    updated[index] = val;
    setFormQuestions(updated);
  };
  const addQuestion = () => {
    setFormQuestions([...formQuestions, '']);
  };
  const removeQuestion = (index: number) => {
    setFormQuestions(formQuestions.filter((_, i) => i !== index));
  };

  // Red Flag helpers
  const handleRedFlagChange = (index: number, val: string) => {
    const updated = [...formRedFlags];
    updated[index] = val;
    setFormRedFlags(updated);
  };
  const addRedFlag = () => {
    setFormRedFlags([...formRedFlags, '']);
  };
  const removeRedFlag = (index: number) => {
    setFormRedFlags(formRedFlags.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const cleanQuestions = formQuestions.map(q => q.trim()).filter(Boolean);
    const cleanRedFlags = formRedFlags.map(rf => rf.trim()).filter(Boolean);

    if (cleanQuestions.length === 0) {
      setError('Protocol must have at least one AI follow-up interview question.');
      setSaving(false);
      return;
    }

    if (cleanRedFlags.length === 0) {
      setError('Protocol must have at least one red-flag symptom for safety escalation.');
      setSaving(false);
      return;
    }

    try {
      if (isNewProtocol) {
        await fetchApi('/api/v1/protocols', {
          method: 'POST',
          body: JSON.stringify({
            name: formName,
            condition_type: formCondition,
            contact_window_hours: Number(formWindow),
            follow_up_questions: cleanQuestions,
            red_flag_symptoms: cleanRedFlags,
            is_active: true,
          })
        });
        setSuccessMsg('New clinical protocol created successfully!');
      } else if (editingProtocol) {
        await fetchApi(`/api/v1/protocols/${editingProtocol.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: formName,
            condition_type: formCondition,
            contact_window_hours: Number(formWindow),
            follow_up_questions: cleanQuestions,
            red_flag_symptoms: cleanRedFlags,
          })
        });
        setSuccessMsg(`Protocol "${formName}" updated! AI voice intake script and escalation rules re-compiled.`);
      }
      closeModal();
      await fetchProtocols();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setError(err.message || 'Failed to save protocol');
    } finally {
      setSaving(false);
    }
  };

  if (loading && protocols.length === 0) {
    return (
      <div className="p-16 flex items-center justify-center">
        <Loader
          size="md"
          title="Loading Clinical Protocols..."
          subtitle="Fetching tenant-isolated safety protocols and AI escalation rules from database"
        />
      </div>
    );
  }

  const primaryHospital = protocols[0]?.hospital_name || 'Hospital';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 mb-1.5">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            Tenant Isolated: {primaryHospital}
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <ClipboardList className="h-7 w-7 text-blue-600" />
            Clinical Outreach Protocols
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Standard operating protocols and safety red flags loaded directly by AI agents for conversational intake and immediate physician escalation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Protocol
          </button>
        </div>
      </div>

      {/* Multi-Tenancy Assurance Banner */}
      <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-blue-900">
        <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Multi-Tenancy Guardrail: </span>
          You are managing protocols for <span className="font-semibold underline">{primaryHospital}</span>. 
          Any edits to follow-up questions or red-flag symptoms are securely saved to your hospital's private tenant in the database, and will <strong>NOT</strong> modify other hospitals.
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium rounded-xl p-3.5 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-xl p-3.5 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Protocols List */}
      <div className="space-y-6">
        {protocols.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-200/90 p-6 space-y-5">
            {/* Card Top Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">{p.name}</h2>
                  {p.hospital_name && (
                    <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                      {p.hospital_name}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-500">
                  <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {p.condition_type}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    Target Outreach Window: {p.contact_window_hours} hours post-discharge
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Protocol Active ({p.version ? `v${p.version}` : 'v1.0'})
                </span>
                <button
                  onClick={() => openEditModal(p)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-blue-50 hover:text-blue-700 border border-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Protocol
                </button>
              </div>
            </div>

            {/* Questions & Red Flags Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: AI Questions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-blue-600" />
                    AI Intake Interview Questions ({p.follow_up_questions?.length || 0})
                  </h3>
                  <span className="text-[10px] text-gray-400">Asked during voice call</span>
                </div>
                <ul className="space-y-2 text-xs text-gray-700 bg-gray-50/70 p-4 rounded-xl border border-gray-200/80">
                  {p.follow_up_questions?.map((q, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="font-bold text-blue-600 text-xs mt-0.5 flex-shrink-0">{idx + 1}.</span>
                      <span className="font-medium">{q}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right Column: Red Flags */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    Red-Flag Symptoms ({p.red_flag_symptoms?.length || 0})
                  </h3>
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                    Triggers Immediate Escalation
                  </span>
                </div>
                <ul className="space-y-2 text-xs text-red-950 bg-red-50/50 p-4 rounded-xl border border-red-200/80">
                  {p.red_flag_symptoms?.map((rf, idx) => (
                    <li key={idx}>
                      <HoverCard openDelay={100} closeDelay={150}>
                        <HoverCardTrigger className="w-full block">
                          <div className="flex items-start gap-2 p-1 rounded-md hover:bg-red-100/60 transition-colors cursor-help">
                            <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                            <span className="font-semibold text-red-900">{rf}</span>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" className="w-80 p-3 shadow-xl border-red-200 bg-white">
                          <div className="space-y-1 text-xs">
                            <h4 className="font-bold text-red-700 flex items-center gap-1.5">
                              <ShieldAlert className="h-4 w-4 text-red-600" />
                              Emergency Arbiter Rule
                            </h4>
                            <p className="text-gray-600 leading-snug">
                              If the patient reports this symptom, conversational outreach terminates instantly. The Deterministic Arbiter records a hard safety veto and triggers urgent clinical notification.
                            </p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Protocol Editor Modal */}
      {(editingProtocol || isNewProtocol) && (
        <div className="fixed inset-0 !m-0 !top-0 !left-0 !right-0 !bottom-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-3xl w-full max-h-[90vh] flex flex-col my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Edit3 className="h-5 w-5 text-blue-600" />
                  {isNewProtocol ? 'Create New Clinical Protocol' : `Edit Protocol: ${editingProtocol?.name}`}
                </h3>
                <p className="text-xs text-gray-500">
                  Tenant: {primaryHospital} • Re-compiles AI Voice Script and Deterministic Arbiter rules
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Protocol Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. General Post-Surgical Follow-Up Protocol"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Condition Specialty
                  </label>
                  <input
                    type="text"
                    required
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    placeholder="e.g. General Surgery"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Target Contact Window (Hours Post-Discharge)
                </label>
                <select
                  value={formWindow}
                  onChange={(e) => setFormWindow(Number(e.target.value))}
                  className="w-full sm:w-60 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                >
                  <option value={24}>24 Hours Post-Discharge</option>
                  <option value={48}>48 Hours Post-Discharge</option>
                  <option value={72}>72 Hours Post-Discharge (Default)</option>
                  <option value={96}>96 Hours Post-Discharge</option>
                </select>
              </div>

              {/* AI Intake Questions Editor */}
              <div className="space-y-3 pt-2 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <ClipboardList className="h-4 w-4 text-blue-600" />
                      AI Intake Interview Questions
                    </h4>
                    <p className="text-xs text-gray-500">The conversational questions spoken by the Voice AI agent</p>
                  </div>
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Question
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formQuestions.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600 w-5 text-right">{idx + 1}.</span>
                      <input
                        type="text"
                        required
                        value={q}
                        onChange={(e) => handleQuestionChange(idx, e.target.value)}
                        placeholder="Enter interview question for AI..."
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeQuestion(idx)}
                        disabled={formQuestions.length <= 1}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Red-Flag Symptoms Editor (Emergency Escalation) */}
              <div className="space-y-3 pt-2 border-t border-gray-200 bg-red-50/40 p-4 rounded-xl border border-red-200/80">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-red-900 flex items-center gap-1.5">
                      <ShieldAlert className="h-4 w-4 text-red-600" />
                      Red-Flag Symptoms (Immediate Doctor Escalation)
                    </h4>
                    <p className="text-xs text-red-700/80">
                      If patient reports any of these symptoms, AI triggers an emergency triage escalation
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addRedFlag}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-100/70 hover:bg-red-200/80 rounded-lg border border-red-300 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Red Flag
                  </button>
                </div>

                <div className="space-y-2.5">
                  {formRedFlags.map((rf, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <input
                        type="text"
                        required
                        value={rf}
                        onChange={(e) => handleRedFlagChange(idx, e.target.value)}
                        placeholder="e.g. Fever over 101°F, sudden chest pain..."
                        className="flex-1 px-3 py-1.5 border border-red-300 rounded-lg text-xs font-semibold text-red-950 focus:ring-2 focus:ring-red-500 outline-none bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeRedFlag(idx)}
                        disabled={formRedFlags.length <= 1}
                        className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-100 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/10 transition-all cursor-pointer disabled:bg-blue-400"
              >
                {saving && <RefreshCw className="h-4 w-4 animate-spin" />}
                {saving ? 'Deploying to AI...' : (isNewProtocol ? 'Create Protocol' : 'Save & Deploy to AI')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
