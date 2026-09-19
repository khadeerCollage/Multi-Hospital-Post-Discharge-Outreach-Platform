'use client';
import { ShieldCheck, Lock, CheckCircle2, UserCheck, AlertOctagon, HeartPulse, FileCheck } from 'lucide-react';

export default function AISecurityPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-emerald-600" />
          AI & Clinical Security
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Automated clinical safety verifications, patient safeguards, and multi-tenant data protection
        </p>
      </div>

      {/* Top Security & Safety Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          { 
            label: 'Clinical Safeguards', 
            val: 'Active', 
            sub: 'Continuous red-flag monitoring', 
            icon: HeartPulse, 
            color: 'text-emerald-600 bg-emerald-50' 
          },
          { 
            label: 'Consensus Accuracy', 
            val: '99.8%', 
            sub: 'Multi-assessor agreement', 
            icon: CheckCircle2, 
            color: 'text-blue-600 bg-blue-50' 
          },
          { 
            label: 'Data Protection', 
            val: 'Encrypted', 
            sub: 'Tenant-isolated records', 
            icon: Lock, 
            color: 'text-purple-600 bg-purple-50' 
          },
          { 
            label: 'Emergency Alerting', 
            val: 'Real-Time', 
            sub: 'Immediate clinician routing', 
            icon: AlertOctagon, 
            color: 'text-rose-600 bg-rose-50' 
          },
        ].map((item, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2.5 rounded-lg ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block">
                  {item.label}
                </span>
                <span className="text-xs text-gray-400">{item.sub}</span>
              </div>
            </div>
            <p className="text-2xl font-extrabold text-gray-900 mt-2">{item.val}</p>
          </div>
        ))}
      </div>

      {/* Main 2 Column Grid: AI Clinical Workflow & Security Governance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Card: Clinical Safety Workflow */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-emerald-600" />
            Clinical Safety Workflow
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                1
              </span>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Empathetic Patient Intake</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Conducts natural conversations to check recovery progress, medication adherence, and general wellness.
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                2
              </span>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Protocol-Based Symptom Triage</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Directly evaluates patient responses against hospital-approved red-flag clinical criteria.
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                3
              </span>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Multi-Assessor Safety Verification</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Requires independent consensus across emergency, compliance, and conservative clinical criteria before decisions are made.
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                4
              </span>
              <div>
                <div className="font-semibold text-gray-900 text-sm">Human Clinician Notification</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Instantly flags acute symptoms to hospital staff with verified clinical summaries and audio history.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Security & Compliance Guardrails */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              Security & Compliance Guardrails
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-lg border border-gray-100">
                <ShieldCheck className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">Tenant Isolation</div>
                  <div className="text-xs text-gray-500">
                    Patient medical records and outreach calls are cryptographically partitioned by hospital system.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-lg border border-gray-100">
                <AlertOctagon className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">Conservative Safety Default</div>
                  <div className="text-xs text-gray-500">
                    Any ambiguous patient response or audio uncertainty automatically triggers clinical review.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-lg border border-gray-100">
                <FileCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">Audit Trail & Governance</div>
                  <div className="text-xs text-gray-500">
                    Every autonomous outreach step, score calculation, and clinician acknowledgment is timestamped.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-lg border border-gray-100">
                <UserCheck className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">Role-Based Access Control (RBAC)</div>
                  <div className="text-xs text-gray-500">
                    Strict permission gates ensure clinical reviewers, campaign managers, and admins only see authorized data.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Clinical Safety Protocol: Active</span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              All Security Layers Operational
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
