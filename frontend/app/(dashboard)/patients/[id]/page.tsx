'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  ArrowLeft, User, Phone, MapPin, Calendar, Clock, 
  Stethoscope, Activity, Users, ShieldCheck, HeartPulse, 
  Pill, AlertCircle, FileText, CheckCircle2, ChevronRight,
  Sparkles, ExternalLink, Edit2, Trash2, X, AlertTriangle,
  Loader2, Check, ShieldAlert
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Loader from '@/components/ui/loader';
import { ClinicalRiskHoverCard } from '@/components/HoverCardDemos';
import { clinicalToast } from '@/lib/toast';

function formatFullDateTime(dtString?: string) {
  if (!dtString) return { dateStr: 'Not recorded', timeStr: '', full: 'N/A', elapsed: '' };
  try {
    const d = new Date(dtString);
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    const diffMs = Date.now() - d.getTime();
    const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    const elapsed = diffHours < 24 ? `${diffHours} hours ago` : `${Math.floor(diffHours / 24)} days ago (${diffHours}h total)`;
    return { dateStr, timeStr, full: `${dateStr} at ${timeStr}`, elapsed };
  } catch {
    return { dateStr: dtString, timeStr: '', full: dtString, elapsed: '' };
  }
}

export default function PatientDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Edit and Delete modal states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isEditOpen || isDeleteOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isEditOpen, isDeleteOpen]);
  const [formData, setFormData] = useState<any>({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    address: '',
    risk_level: 'moderate',
    preferred_language: 'en',
    primary_diagnosis: '',
    procedure_name: '',
    attending_physician: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const openEditModal = () => {
    if (!patient) return;
    const enc = patient.latest_encounter || (patient.encounters && patient.encounters[0]);
    setFormData({
      first_name: patient.first_name || '',
      last_name: patient.last_name || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      risk_level: patient.risk_level || 'moderate',
      preferred_language: patient.preferred_language || 'en',
      primary_diagnosis: enc?.primary_diagnosis || '',
      procedure_name: enc?.procedure_name || '',
      attending_physician: enc?.attending_physician || '',
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        risk_level: formData.risk_level,
        preferred_language: formData.preferred_language,
        primary_diagnosis: formData.primary_diagnosis.trim() || null,
        procedure_name: formData.procedure_name.trim() || null,
        attending_physician: formData.attending_physician.trim() || null,
      };

      await fetchApi(`/api/v1/patients/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      const updated = await fetchApi(`/api/v1/patients/${params.id}`);
      setPatient(updated);
      setIsEditOpen(false);
      clinicalToast.success(`Patient record for ${formData.first_name} ${formData.last_name} updated successfully.`);
      setSuccessBanner('Patient record updated successfully.');
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update patient record.');
      clinicalToast.error(err.message || 'Failed to update patient record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setIsSubmitting(true);
    try {
      await fetchApi(`/api/v1/patients/${params.id}`, {
        method: 'DELETE',
      });
      setIsDeleteOpen(false);
      clinicalToast.info('Patient record permanently deleted.');
      router.push('/patients');
      router.refresh();
    } catch (err: any) {
      clinicalToast.error(`Deletion failed: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetchApi(`/api/v1/patients/${params.id}`)
      .then(setPatient)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const getRiskBadge = (risk: string) => {
    const m: any = {
      critical: 'bg-red-50 text-red-700 border-red-200 ring-red-500/10',
      high: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-500/10',
      moderate: 'bg-yellow-50 text-yellow-800 border-yellow-200 ring-yellow-500/10',
      low: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/10',
      routine: 'bg-gray-50 text-gray-700 border-gray-200 ring-gray-500/10',
    };
    return m[risk] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  if (loading) {
    return (
      <div className="p-16 flex items-center justify-center">
        <Loader
          size="md"
          title="Retrieving Clinical Dossier..."
          subtitle="Loading surgical history, participating doctors team, and pre-discharge checkups"
        />
      </div>
    );
  }

  if (error) return <div className="p-8 text-red-600 font-semibold bg-red-50 rounded-xl m-6 border border-red-200">Error: {error}</div>;
  if (!patient) return <div className="p-8 text-gray-500">Patient not found</div>;

  const enc = patient.latest_encounter || (patient.encounters && patient.encounters[0]);
  const discharge = formatFullDateTime(enc?.discharge_date);
  const admission = formatFullDateTime(enc?.admission_date);
  const surgicalTeam: any[] = enc?.surgical_team || [];
  const checkup = enc?.medical_checkup || {};
  const vitals = checkup.discharge_vitals;
  const carePlan = patient.care_plans?.[0];

  return (
    <div className="p-6 lg:p-8 max-w-[1300px] mx-auto space-y-6">
      {/* Top Navigation & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link 
          href="/patients" 
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-white px-3.5 py-1.5 rounded-lg border border-gray-200 shadow-2xs"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Patients Roster
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openEditModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-blue-50 hover:text-blue-700 border border-gray-200 hover:border-blue-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Record
          </button>
          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50/60 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Patient
          </button>
          <span className="text-xs text-gray-400 font-mono hidden sm:inline ml-2">
            EHR ID: {patient.id?.slice(0, 8)}...
          </span>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl p-3.5 flex items-center justify-between shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Patient Header Banner */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200/90 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center text-xl font-bold shadow-md shadow-blue-500/20 flex-shrink-0">
              {patient.first_name?.[0]}{patient.last_name?.[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                  {patient.first_name} {patient.last_name}
                </h1>
                <span className={`px-3 py-1 text-xs font-bold rounded-full border ring-2 ${getRiskBadge(patient.risk_level)}`}>
                  {patient.risk_level?.toUpperCase()} RISK
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500 font-medium">
                <span className="font-mono text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  MRN: {patient.mrn}
                </span>
                <span>•</span>
                <span className="capitalize">{patient.gender}</span>
                <span>•</span>
                <span>DOB: {patient.date_of_birth}</span>
                <span>•</span>
                <span>Lang: {patient.preferred_language?.toUpperCase() || 'EN'}</span>
                <span>•</span>
                <span className={patient.communication_consent ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                  {patient.communication_consent ? '✓ Consent Verified' : 'No Consent'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0 border-gray-100">
            <div className="text-right">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Follow-Up Window</div>
              <div className="text-sm font-bold text-blue-700">72-Hour Post-Op Outreach</div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-sm">
              72h
            </div>
          </div>
        </div>
      </div>

      {/* Discharge Timing & Safety Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 rounded-2xl text-white p-6 shadow-xl border border-blue-800/40">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-400/30">
              <Clock className="h-3.5 w-3.5 text-blue-300" /> Exact Clinical Discharge Record
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {discharge.full}
            </h2>
            <p className="text-xs text-blue-200/80">
              Admission: {admission.dateStr || 'Recent'} • Length of stay: Inpatient observation & post-op recovery completed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15">
              <div className="text-[10px] uppercase tracking-wider text-blue-200">Elapsed Post-Op</div>
              <div className="text-sm font-bold text-white">{discharge.elapsed || 'Recent'}</div>
            </div>
            <div className="bg-emerald-500/20 backdrop-blur-md px-4 py-2.5 rounded-xl border border-emerald-400/30">
              <div className="text-[10px] uppercase tracking-wider text-emerald-200">Disposition</div>
              <div className="text-sm font-bold text-emerald-300">{enc?.discharge_disposition?.toUpperCase() || 'HOME / SELF-CARE'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Clinical Grid: Operation Details + Doctors Team */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 spans): Operation & Surgical Details */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Operation Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/90 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Surgical & Operation Record</h3>
                  <p className="text-xs text-gray-500">Documented procedure and diagnosis codes</p>
                </div>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {enc?.procedure_type || 'General Surgery'}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Operation Done</label>
                <div className="text-base font-bold text-gray-900 mt-0.5">
                  {enc?.procedure_name || enc?.primary_diagnosis || 'Post-Discharge Procedure'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                  <span className="text-[11px] font-semibold text-gray-500">Primary Clinical Diagnosis</span>
                  <div className="font-semibold text-gray-900 text-sm mt-0.5">{enc?.primary_diagnosis}</div>
                </div>
                <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-100">
                  <span className="text-[11px] font-semibold text-gray-500">ICD-10 Diagnosis Codes</span>
                  <div className="font-mono text-xs font-bold text-blue-700 mt-0.5">
                    {enc?.diagnosis_codes?.length > 0 ? enc.diagnosis_codes.join(', ') : 'Z96.65, K80.20'}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50/80 rounded-xl p-3.5 border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-500">Care Setting & Unit</span>
                <div className="font-semibold text-gray-900 text-sm capitalize mt-0.5">
                  {enc?.care_setting?.replace('_', ' ') || 'Surgical Inpatient Ward'}
                </div>
              </div>

              {enc?.discharge_instructions && (
                <div className="bg-blue-50/60 rounded-xl p-3.5 border border-blue-100 text-xs">
                  <span className="font-semibold text-blue-900 block mb-1">Discharge Instructions to Patient</span>
                  <p className="text-blue-800 leading-relaxed">{enc.discharge_instructions}</p>
                </div>
              )}
            </div>
          </div>

          {/* Pre-Discharge Medical Checkup & Vitals Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/90 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                  <HeartPulse className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Pre-Discharge Medical Checkup</h3>
                  <p className="text-xs text-gray-500">Clinical clearance examination & vitals prior to hospital exit</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {checkup.discharge_status || 'Clinically Cleared'}
              </div>
            </div>

            {/* Vitals Numbers Grid */}
            {vitals && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-rose-50/50 rounded-xl p-3 border border-rose-100/80 text-center">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Blood Pressure</span>
                  <div className="text-sm font-bold text-gray-900 mt-1">{vitals.blood_pressure}</div>
                  <span className="text-[9px] text-emerald-600 font-semibold">Normotensive</span>
                </div>

                <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/80 text-center">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Heart Rate</span>
                  <div className="text-sm font-bold text-gray-900 mt-1">{vitals.heart_rate}</div>
                  <span className="text-[9px] text-blue-600 font-semibold">Normal Sinus</span>
                </div>

                <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/80 text-center">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Oxygen (SpO2)</span>
                  <div className="text-sm font-bold text-gray-900 mt-1">{vitals.spo2}</div>
                  <span className="text-[9px] text-emerald-600 font-semibold">Room Air</span>
                </div>

                <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/80 text-center">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Temperature</span>
                  <div className="text-sm font-bold text-gray-900 mt-1">{vitals.temperature}</div>
                  <span className="text-[9px] text-amber-700 font-semibold">Afebrile</span>
                </div>

                <div className="bg-purple-50/50 rounded-xl p-3 border border-purple-100/80 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Respiration</span>
                  <div className="text-sm font-bold text-gray-900 mt-1">{vitals.respiratory_rate}</div>
                  <span className="text-[9px] text-purple-600 font-semibold">Unlabored</span>
                </div>
              </div>
            )}

            {/* Checkup Findings Breakdown */}
            <div className="space-y-2.5 pt-2 text-xs">
              {checkup.surgical_site_status && (
                <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <span className="font-semibold text-gray-700 w-36 flex-shrink-0">Surgical Site Assessment:</span>
                  <span className="text-gray-900 font-medium">{checkup.surgical_site_status}</span>
                </div>
              )}

              {checkup.pain_level_at_discharge && (
                <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <span className="font-semibold text-gray-700 w-36 flex-shrink-0">Pain Score at Exit:</span>
                  <span className="text-gray-900 font-medium">{checkup.pain_level_at_discharge}</span>
                </div>
              )}

              {checkup.mobility_status && (
                <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <span className="font-semibold text-gray-700 w-36 flex-shrink-0">Mobility & Ambulation:</span>
                  <span className="text-gray-900 font-medium">{checkup.mobility_status}</span>
                </div>
              )}

              {checkup.lab_clearance && (
                <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <span className="font-semibold text-gray-700 w-36 flex-shrink-0">Lab Panels Clearance:</span>
                  <span className="text-gray-900 font-medium">{checkup.lab_clearance}</span>
                </div>
              )}

              {checkup.clearing_physician && (
                <div className="flex items-start gap-2 bg-emerald-50/60 rounded-xl p-3 border border-emerald-100 text-emerald-900">
                  <span className="font-semibold w-36 flex-shrink-0">Clearing Physician:</span>
                  <span className="font-bold">{checkup.clearing_physician}</span>
                </div>
              )}
            </div>
          </div>

          {/* Care Plan & Medications */}
          {carePlan && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200/90 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Discharge Medication & Care Plan</h3>
                  <p className="text-xs text-gray-500">Post-operative prescriptions and follow-up directives</p>
                </div>
              </div>

              <div className="space-y-3">
                {carePlan.medications?.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">
                      Prescribed Medications
                    </label>
                    <div className="space-y-2">
                      {carePlan.medications.map((med: any, i: number) => (
                        <div key={i} className="flex items-center justify-between bg-teal-50/40 border border-teal-100/80 rounded-xl p-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-teal-500"></span>
                            <span className="font-bold text-gray-900">{med.name}</span>
                            <span className="text-gray-500">({med.dose})</span>
                          </div>
                          <span className="font-semibold text-teal-800">{med.frequency}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {carePlan.follow_up_appointments?.length > 0 && (
                  <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100/70 text-xs flex items-center justify-between">
                    <span className="font-semibold text-blue-900">Scheduled Follow-Up Appointment:</span>
                    <span className="font-bold text-blue-700">Within 1-2 Weeks (Outpatient Surgical Clinic)</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 span): Participating Doctors Team & Contact */}
        <div className="space-y-6">

          {/* Participating Doctors Team Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/90 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Participating Doctors</h3>
                  <p className="text-xs text-gray-500">Surgical & medical team in care</p>
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                {surgicalTeam.length} Specialists
              </span>
            </div>

            <div className="space-y-3">
              {surgicalTeam.map((member: any, index: number) => {
                const isLead = member.role?.includes('Lead') || member.role?.includes('Surgeon');
                return (
                  <div 
                    key={index}
                    className={`rounded-xl p-3.5 border transition-all ${
                      isLead 
                        ? 'bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border-blue-200/90 shadow-2xs' 
                        : 'bg-gray-50/70 border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                        isLead 
                          ? 'bg-blue-600 text-white shadow-xs' 
                          : 'bg-white border border-gray-200 text-gray-700'
                      }`}>
                        {member.name?.split(' ')?.[1]?.[0] || 'D'}
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-gray-900 text-xs truncate">
                            {member.name}
                          </span>
                          {isLead && (
                            <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.2 rounded">
                              Lead
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-semibold text-blue-700">
                          {member.role}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate">
                          {member.specialty}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact & Demographics Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/90 p-6 space-y-4">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2 border-b border-gray-100 pb-3">
              <User className="h-5 w-5 text-gray-500" /> Patient Contact & Consent
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-gray-400" /> Phone
                </span>
                <span className="font-bold text-gray-900">{patient.phone}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900 truncate max-w-[180px]">{patient.email || 'None on file'}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" /> Address
                </span>
                <span className="font-medium text-gray-900">{patient.address || 'Standard Residence'}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500">AI Outreach Consent</span>
                <span className={`font-bold ${patient.communication_consent ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {patient.communication_consent ? '✓ Granted' : '✗ Declined'}
                </span>
              </div>
            </div>
          </div>

          {/* Clinical Observations from AI Calls */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/90 p-6 space-y-3">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2 border-b border-gray-100 pb-3">
              <Activity className="h-5 w-5 text-teal-600" /> Post-Op AI Observations ({patient.observations?.length || 0})
            </h3>
            {patient.observations?.length > 0 ? (
              <div className="space-y-2">
                {patient.observations.map((obs: any) => (
                  <div key={obs.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-800">{obs.display || obs.code}</span>
                    <span className="font-mono text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded">{obs.value_string || obs.interpretation || 'Normal'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 leading-relaxed">
                No observations yet. Clinical AI will autonomously log symptoms and observations during the post-discharge outreach interview.
              </p>
            )}
          </div>

        </div>

      </div>

      {/* ═══ MODAL 1: EDIT PATIENT RECORD (Portal, Zero Gap, Sticky Footer) ═══ */}
      {mounted && isEditOpen && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setIsEditOpen(false); }}
          className="fixed inset-0 !m-0 !top-0 !left-0 !right-0 !bottom-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fade-in"
        >
          <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-2xl max-h-[86vh] flex flex-col overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                  <Edit2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Edit Patient Record</h2>
                  <p className="text-xs text-gray-500">Update clinical details for {patient.first_name} {patient.last_name} ({patient.mrn})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form id="edit-patient-form" onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {formError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Risk Acuity Tier</label>
                  <select
                    value={formData.risk_level}
                    onChange={e => setFormData({ ...formData, risk_level: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white capitalize"
                  >
                    <option value="routine">Routine</option>
                    <option value="low">Low Risk</option>
                    <option value="moderate">Moderate Risk</option>
                    <option value="high">High Risk</option>
                    <option value="critical">Critical Risk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Preferred Language</label>
                  <select
                    value={formData.preferred_language}
                    onChange={e => setFormData({ ...formData, preferred_language: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="en">English (US)</option>
                    <option value="te">Telugu (తెలుగు)</option>
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="es">Spanish (Español)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Procedure / Operation</label>
                  <input
                    type="text"
                    value={formData.procedure_name}
                    onChange={e => setFormData({ ...formData, procedure_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Attending Physician</label>
                  <input
                    type="text"
                    value={formData.attending_physician}
                    onChange={e => setFormData({ ...formData, attending_physician: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </form>

            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/90 backdrop-blur-xs flex items-center justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-patient-form"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Update Patient</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ MODAL 2: DELETE PATIENT CONFIRMATION (Portal, Zero Gap) ═══ */}
      {mounted && isDeleteOpen && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setIsDeleteOpen(false); }}
          className="fixed inset-0 !m-0 !top-0 !left-0 !right-0 !bottom-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fade-in"
        >
          <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Patient Record</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Are you sure you want to permanently delete patient <strong>{patient.first_name} {patient.last_name}</strong> ({patient.mrn})?
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  Cascading Records Warning
                </div>
                <p className="text-[11px] text-amber-700">
                  This will permanently delete all associated encounters, care plans, call records, and clinical triage observations. You will be returned to the roster.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Confirm Deletion</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}