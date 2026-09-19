'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Calendar,
  Clock,
  Stethoscope,
  Activity,
  Users,
  ChevronRight,
  CheckCircle2,
  UserPlus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
  Check,
  RefreshCw,
  FileText,
  Phone,
  Mail,
  ShieldAlert,
} from 'lucide-react';
import { fetchApi } from '@/lib/api';
import Link from 'next/link';
import { ClinicalRiskHoverCard } from '@/components/HoverCardDemos';
import { PatientsEmptyState } from '@/components/EmptyState';
import { HospitalPagination } from '@/components/HospitalPagination';
import { clinicalToast } from '@/lib/toast';

function formatDischarge(dtString?: string) {
  if (!dtString) return { dateStr: 'Pending Discharge', timeStr: '', elapsed: '' };
  try {
    const d = new Date(dtString);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const diffMs = Date.now() - d.getTime();
    const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
    const elapsed = diffHours < 24 ? `${diffHours}h post-op` : `${Math.floor(diffHours / 24)}d post-op`;
    return { dateStr, timeStr, elapsed };
  } catch {
    return { dateStr: dtString, timeStr: '', elapsed: '' };
  }
}

interface PatientFormData {
  mrn: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  risk_level: string;
  preferred_language: string;
  primary_diagnosis: string;
  procedure_name: string;
  attending_physician: string;
  discharge_date: string;
}

const initialFormData: PatientFormData = {
  mrn: '',
  first_name: '',
  last_name: '',
  date_of_birth: '1985-05-20',
  gender: 'male',
  phone: '',
  email: '',
  address: '',
  risk_level: 'moderate',
  preferred_language: 'en',
  primary_diagnosis: '',
  procedure_name: '',
  attending_physician: '',
  discharge_date: new Date().toISOString().slice(0, 16),
};

export default function Patients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const pageSize = 20;

  // Modals state
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [formData, setFormData] = useState<PatientFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isRegisterOpen || isEditOpen || isDeleteOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isRegisterOpen, isEditOpen, isDeleteOpen]);

  const fetchPatients = async (overrideSearch?: string) => {
    setLoading(true);
    const query = overrideSearch !== undefined ? overrideSearch : search;
    try {
      const data = await fetchApi(`/api/v1/patients?search=${encodeURIComponent(query)}&page=${page}&page_size=${pageSize}`);
      setPatients(data?.items || data || []);
      setTotal(data?.total || 0);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [page]);

  // Check URL query parameters for ?action=register from CreateMenu
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'register') {
        openRegisterModal();
        // Clean query parameter from URL without reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPatients();
  };

  const handleReset = () => {
    setSearch('');
    setPage(1);
    fetchPatients('');
  };

  // Helper to generate a unique random MRN
  const generateRandomMRN = () => {
    const num = Math.floor(100000 + Math.random() * 900000);
    setFormData(prev => ({ ...prev, mrn: `MRN-HOSP-${num}` }));
  };

  const openRegisterModal = () => {
    setFormData({
      ...initialFormData,
      mrn: `MRN-HOSP-${Math.floor(100000 + Math.random() * 900000)}`,
      discharge_date: new Date().toISOString().slice(0, 16),
    });
    setFormError(null);
    setIsRegisterOpen(true);
  };

  const openEditModal = (p: any) => {
    setSelectedPatient(p);
    const enc = p.latest_encounter;
    setFormData({
      mrn: p.mrn || '',
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      date_of_birth: p.date_of_birth ? p.date_of_birth.split('T')[0] : '1985-01-01',
      gender: p.gender || 'male',
      phone: p.phone || '',
      email: p.email || '',
      address: p.address || '',
      risk_level: p.risk_level || 'moderate',
      preferred_language: p.preferred_language || 'en',
      primary_diagnosis: enc?.primary_diagnosis || '',
      procedure_name: enc?.procedure_name || '',
      attending_physician: enc?.attending_physician || '',
      discharge_date: enc?.discharge_date ? enc.discharge_date.slice(0, 16) : new Date().toISOString().slice(0, 16),
    });
    setFormError(null);
    setIsEditOpen(true);
  };

  const openDeleteModal = (p: any) => {
    setSelectedPatient(p);
    setIsDeleteOpen(true);
  };

  // Handle Create Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.mrn.trim() || !formData.first_name.trim() || !formData.last_name.trim() || !formData.phone.trim()) {
      setFormError('Please fill in MRN, First Name, Last Name, and Phone Number.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        mrn: formData.mrn.trim(),
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        risk_level: formData.risk_level,
        communication_consent: true,
        preferred_language: formData.preferred_language,
        primary_diagnosis: formData.primary_diagnosis.trim() || null,
        procedure_name: formData.procedure_name.trim() || null,
        attending_physician: formData.attending_physician.trim() || null,
        discharge_date: formData.discharge_date ? new Date(formData.discharge_date).toISOString() : null,
      };

      await fetchApi('/api/v1/patients', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setIsRegisterOpen(false);
      clinicalToast.patientRegistered(`${formData.first_name} ${formData.last_name}`, formData.mrn);
      setSuccessBanner(`Patient ${formData.first_name} ${formData.last_name} (${formData.mrn}) registered successfully!`);
      setTimeout(() => setSuccessBanner(null), 5000);
      fetchPatients();
    } catch (err: any) {
      clinicalToast.error(err.message || 'Failed to register patient.');
      setFormError(err.message || 'Failed to register patient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;

    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        date_of_birth: formData.date_of_birth,
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        risk_level: formData.risk_level,
        preferred_language: formData.preferred_language,
        primary_diagnosis: formData.primary_diagnosis.trim() || null,
        procedure_name: formData.procedure_name.trim() || null,
        attending_physician: formData.attending_physician.trim() || null,
      };

      await fetchApi(`/api/v1/patients/${selectedPatient.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setIsEditOpen(false);
      clinicalToast.success(`Patient ${formData.first_name} ${formData.last_name} updated successfully.`);
      setSuccessBanner(`Patient ${formData.first_name} ${formData.last_name} updated successfully.`);
      setTimeout(() => setSuccessBanner(null), 5000);
      fetchPatients();
    } catch (err: any) {
      clinicalToast.error(err.message || 'Failed to update patient.');
      setFormError(err.message || 'Failed to update patient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Submit
  const handleDeleteSubmit = async () => {
    if (!selectedPatient) return;

    const patientToDelete = selectedPatient;
    const deletedId = patientToDelete.id;
    const patientName = `${patientToDelete.first_name} ${patientToDelete.last_name}`;
    const patientMrn = patientToDelete.mrn;

    setIsSubmitting(true);

    // 1. Optimistic removal: remove immediately from local state so the table updates with zero lag
    setPatients(prev => prev.filter(p => p.id !== deletedId));
    setTotal(prev => Math.max(0, prev - 1));
    setIsDeleteOpen(false);

    try {
      await fetchApi(`/api/v1/patients/${deletedId}`, {
        method: 'DELETE',
      });

      clinicalToast.info(`Patient record for ${patientName} (${patientMrn}) deleted.`);
      setSuccessBanner(`Patient record and clinical data for ${patientName} (${patientMrn}) permanently deleted.`);
      setTimeout(() => setSuccessBanner(null), 5000);
      
      // Re-fetch to synchronize pagination & server state cleanly
      await fetchPatients();
    } catch (err: any) {
      clinicalToast.error(`Deletion failed: ${err.message || 'Unknown error'}`);
      // Revert optimistic update on failure by re-fetching
      await fetchPatients();
    } finally {
      setIsSubmitting(false);
      setSelectedPatient(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      {/* Header & Register Action */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 mb-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            Real-Time Clinical Records & CRUD
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Discharged Patients Roster</h1>
          <p className="text-gray-500 text-sm mt-1">
            Tracking post-op surgical encounters, participating medical teams, discharge vitals, and 72-hour clinical outreach windows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openRegisterModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            <span>Register Patient</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
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

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">{error}</div>}

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients by name or MRN (e.g. MRN-CITY-10000)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-2xs"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
        >
          Search
        </button>
      </form>

      {/* Patients Table */}
      {!loading && patients.length === 0 ? (
        <PatientsEmptyState onReset={handleReset} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/80 text-gray-600 uppercase text-[11px] tracking-wider border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3.5">Patient Details</th>
                  <th className="px-5 py-3.5">Discharge Date & Time</th>
                  <th className="px-5 py-3.5">Operation / Procedure</th>
                  <th className="px-5 py-3.5">Participating Doctors</th>
                  <th className="px-5 py-3.5">Pre-Discharge Checkup</th>
                  <th className="px-5 py-3.5">Risk Status</th>
                  <th className="px-5 py-3.5 text-right">Actions & Dossier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-400">Loading comprehensive surgical roster...</td></tr>
                ) : patients.map((p: any) => {
                  const enc = p.latest_encounter;
                  const discharge = formatDischarge(enc?.discharge_date);
                  const team: any[] = enc?.surgical_team || [];
                  const leadDoctor = team.find((t: any) => t.role?.includes('Lead') || t.role?.includes('Surgeon')) || team[0];
                  const vitals = enc?.medical_checkup?.discharge_vitals;

                  return (
                    <tr key={p.id} className="hover:bg-blue-50/30 transition-colors">
                      {/* 1. Patient Details */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900 text-sm">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span className="font-mono text-blue-700 font-semibold">{p.mrn}</span>
                          <span>•</span>
                          <span className="capitalize">{p.gender}</span>
                          <span>•</span>
                          <span>DOB: {p.date_of_birth ? p.date_of_birth.split('T')[0] : '--'}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                          {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                          {p.preferred_language && (
                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded uppercase text-[10px] font-medium">
                              {p.preferred_language}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. Discharge Date & Time */}
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                            <Calendar className="h-3.5 w-3.5 text-blue-600" />
                            {discharge.dateStr}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span>{discharge.timeStr || '14:30 PM'}</span>
                            <span className="text-blue-600 font-medium ml-1 bg-blue-50 px-1.5 py-0.2 rounded">
                              {discharge.elapsed}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Operation / Procedure */}
                      <td className="px-5 py-4 max-w-[260px]">
                        <div className="font-medium text-gray-900 text-xs leading-snug line-clamp-2">
                          {enc?.procedure_name || enc?.primary_diagnosis || 'Post-Surgical Follow-Up'}
                        </div>
                        <div className="mt-1">
                          <span className="inline-block text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                            {enc?.procedure_type || 'General Surgery'}
                          </span>
                        </div>
                      </td>

                      {/* 4. Participating Doctors */}
                      <td className="px-5 py-4">
                        <div className="relative group inline-block">
                          <div className="flex items-center gap-1.5 cursor-pointer">
                            <Stethoscope className="h-3.5 w-3.5 text-teal-600 flex-shrink-0" />
                            <span className="text-xs font-semibold text-gray-900 truncate max-w-[140px]">
                              {leadDoctor?.name || enc?.attending_physician || 'Staff Physician'}
                            </span>
                          </div>
                          {team.length > 1 && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-teal-700 font-medium">
                              <span className="bg-teal-50 border border-teal-200/80 px-1.5 py-0.2 rounded-full text-[10px]">
                                +{team.length - 1} surgical team
                              </span>
                            </div>
                          )}

                          {/* Hover popover for full team */}
                          {team.length > 0 && (
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-30 w-72 p-3 bg-gray-900 text-white rounded-xl shadow-2xl text-xs pointer-events-none">
                              <div className="font-bold text-teal-300 pb-1.5 mb-2 border-b border-gray-700 flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5" /> Participating Surgical Team
                              </div>
                              <div className="space-y-2">
                                {team.map((member: any, idx: number) => (
                                  <div key={idx} className="flex flex-col">
                                    <span className="font-semibold text-white">{member.name}</span>
                                    <span className="text-[10px] text-gray-300">{member.role} — {member.specialty}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 5. Pre-Discharge Checkup */}
                      <td className="px-5 py-4">
                        {vitals ? (
                          <div className="flex flex-col gap-0.5 text-xs">
                            <div className="flex items-center gap-1 text-gray-800 font-medium">
                              <Activity className="h-3 w-3 text-rose-500 flex-shrink-0" />
                              <span>{vitals.blood_pressure} • {vitals.heart_rate}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                              <span>SpO2 {vitals.spo2?.split(' ')?.[0] || '99%'} • {vitals.temperature?.split(' ')?.[0] || '98.4°F'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Vitals on file</span>
                        )}
                      </td>

                      {/* 6. Risk Status */}
                      <td className="px-5 py-4">
                        <ClinicalRiskHoverCard riskLevel={p.risk_level} side="top" />
                      </td>

                      {/* 7. Action Buttons (CRUD + Dossier) */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            title="Edit Patient Details"
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200 cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => openDeleteModal(p)}
                            title="Delete Patient Record"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                          {/* Dossier Link */}
                          <Link
                            href={`/patients/${p.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                          >
                            Dossier
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {total > pageSize && (
            <div className="px-6 py-4 border-t bg-gray-50/50">
              <HospitalPagination
                currentPage={page}
                totalCount={total}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {/* ═══ MODAL 1: REGISTER NEW PATIENT (Portal, Zero Gap, Sticky Footer) ═══ */}
      {mounted && isRegisterOpen && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setIsRegisterOpen(false); }}
          className="fixed inset-0 !m-0 !top-0 !left-0 !right-0 !bottom-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fade-in"
        >
          <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-2xl max-h-[86vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header (Fixed at top) */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Register New Patient</h2>
                  <p className="text-xs text-gray-500">Add clinical admission dossier and initialize post-discharge protocol.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRegisterOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form Body (Scrollable) */}
            <form id="register-patient-form" onSubmit={handleRegisterSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {formError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Section 1: Demographics */}
              <div>
                <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">1</span>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Patient Identification & Demographics</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* MRN */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700">MRN (Medical Record Number)*</label>
                      <button
                        type="button"
                        onClick={generateRandomMRN}
                        className="text-[11px] text-blue-600 hover:underline font-medium cursor-pointer"
                      >
                        Auto-generate
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.mrn}
                      onChange={e => setFormData({ ...formData, mrn: e.target.value })}
                      placeholder="e.g. MRN-HOSP-748291"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Risk Tier */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Clinical Risk Acuity Tier*</label>
                    <select
                      value={formData.risk_level}
                      onChange={e => setFormData({ ...formData, risk_level: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white capitalize"
                    >
                      <option value="routine">Routine (Standard Post-Op)</option>
                      <option value="low">Low Risk</option>
                      <option value="moderate">Moderate Risk</option>
                      <option value="high">High Risk (Elderly / Comorbidities)</option>
                      <option value="critical">Critical Risk (Intensive Monitoring)</option>
                    </select>
                  </div>

                  {/* First Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">First Name*</label>
                    <input
                      type="text"
                      required
                      value={formData.first_name}
                      onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="e.g. Eleanor"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Last Name*</label>
                    <input
                      type="text"
                      required
                      value={formData.last_name}
                      onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="e.g. Vance"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* DOB */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Date of Birth*</label>
                    <input
                      type="date"
                      required
                      value={formData.date_of_birth}
                      onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Gender*</label>
                    <select
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white capitalize"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other / Non-Binary</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact & Language */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">2</span>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Contact & Outreach Preferences</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Contact Phone Number*</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1-555-019-2834"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Preferred Language */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Preferred Outreach Language</label>
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

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Email (Optional)</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="patient@example.com"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Residential Address (Optional)</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData({ ...formData, address: e.target.value })}
                      placeholder="City, State"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Clinical Encounter Details */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3 pb-1 border-b border-slate-100">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">3</span>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Surgical Encounter & Discharge</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Procedure */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Surgical Procedure / Operation</label>
                    <input
                      type="text"
                      value={formData.procedure_name}
                      onChange={e => setFormData({ ...formData, procedure_name: e.target.value })}
                      placeholder="e.g. Laparoscopic Cholecystectomy"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Primary Diagnosis */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Primary Clinical Diagnosis</label>
                    <input
                      type="text"
                      value={formData.primary_diagnosis}
                      onChange={e => setFormData({ ...formData, primary_diagnosis: e.target.value })}
                      placeholder="e.g. Acute Cholecystitis"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Attending Physician */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Attending Physician / Surgeon</label>
                    <input
                      type="text"
                      value={formData.attending_physician}
                      onChange={e => setFormData({ ...formData, attending_physician: e.target.value })}
                      placeholder="e.g. Dr. Meredith Grey, MD"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  {/* Discharge Date */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Discharge Date & Time</label>
                    <input
                      type="datetime-local"
                      value={formData.discharge_date}
                      onChange={e => setFormData({ ...formData, discharge_date: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    />
                  </div>
                </div>
              </div>
            </form>

            {/* Sticky Modal Footer (Permanently Visible at bottom) */}
            <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/90 backdrop-blur-xs flex items-center justify-between flex-shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">* Required clinical fields</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="register-patient-form"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Patient...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Register & Establish Protocol</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ MODAL 2: EDIT PATIENT (Portal, Zero Gap, Sticky Footer) ═══ */}
      {mounted && isEditOpen && selectedPatient && createPortal(
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setIsEditOpen(false); }}
          className="fixed inset-0 !m-0 !top-0 !left-0 !right-0 !bottom-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md animate-fade-in"
        >
          <div className="relative bg-white rounded-2xl border border-slate-200/90 shadow-2xl w-full max-w-2xl max-h-[86vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Header (Fixed at top) */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                  <Edit2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Edit Patient Record</h2>
                  <p className="text-xs text-gray-500">Update demographic and clinical details for {selectedPatient.mrn}</p>
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

            {/* Body (Scrollable) */}
            <form id="edit-patient-form" onSubmit={handleEditSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {formError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2.5">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
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

                {/* Last Name */}
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

                {/* Phone */}
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

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Risk Tier */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Risk Level</label>
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

                {/* Preferred Language */}
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

                {/* Procedure */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Procedure / Operation</label>
                  <input
                    type="text"
                    value={formData.procedure_name}
                    onChange={e => setFormData({ ...formData, procedure_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {/* Attending Physician */}
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
            </form>

            {/* Footer (Fixed at bottom) */}
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

      {/* ═══ MODAL 3: DELETE PATIENT CONFIRMATION (Portal, Zero Gap) ═══ */}
      {mounted && isDeleteOpen && selectedPatient && createPortal(
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
                  Are you sure you want to permanently delete patient <strong>{selectedPatient.first_name} {selectedPatient.last_name}</strong> ({selectedPatient.mrn})?
                </p>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-800 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  Cascading Records Warning
                </div>
                <p className="text-[11px] text-amber-700">
                  This will permanently delete all associated encounters, care plans, call records, and clinical triage observations. This action cannot be undone.
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
                  className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
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
