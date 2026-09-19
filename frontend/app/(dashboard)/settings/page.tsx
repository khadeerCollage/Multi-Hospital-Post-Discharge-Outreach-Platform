'use client';
import { useState } from 'react';
import { Settings, Bell, PhoneCall, Shield, Save } from 'lucide-react';

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    calling_hours_start: '09:00',
    calling_hours_end: '18:00',
    max_concurrent_calls: 10,
    max_retry_attempts: 5,
    retry_interval_minutes: 15,
    auto_escalate_high_risk: true,
    require_clinical_review: true,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-7 w-7 text-blue-600" />
          Hospital Calling & Safety Configuration
        </h1>
        <p className="text-gray-500 text-sm mt-1">Configure calling hours, retry windows, and clinical escalation parameters</p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-4 mb-6">
          Settings successfully updated!
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-blue-600" /> Telephony & Capacity Limits
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Calling Hours Start</label>
              <input
                type="time"
                value={settings.calling_hours_start}
                onChange={e => setSettings({...settings, calling_hours_start: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Calling Hours End</label>
              <input
                type="time"
                value={settings.calling_hours_end}
                onChange={e => setSettings({...settings, calling_hours_end: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Max Concurrent Outbound Lines</label>
              <input
                type="number"
                min="1"
                max="50"
                value={settings.max_concurrent_calls}
                onChange={e => setSettings({...settings, max_concurrent_calls: parseInt(e.target.value) || 10})}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Max Retry Attempts per Patient</label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.max_retry_attempts}
                onChange={e => setSettings({...settings, max_retry_attempts: parseInt(e.target.value) || 5})}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="border-t pt-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" /> Clinical Safety Guardrails
          </h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_escalate_high_risk}
                onChange={e => setSettings({...settings, auto_escalate_high_risk: e.target.checked})}
                className="h-4 w-4 rounded text-blue-600"
              />
              <div>
                <div className="text-sm font-semibold text-gray-800">Auto-escalate on any Red Flag</div>
                <div className="text-xs text-gray-500">Automatically routes patient encounter to clinical reviewer if any red-flag symptom is detected</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.require_clinical_review}
                onChange={e => setSettings({...settings, require_clinical_review: e.target.checked})}
                className="h-4 w-4 rounded text-blue-600"
              />
              <div>
                <div className="text-sm font-semibold text-gray-800">Conservative Default on Model Ambiguity</div>
                <div className="text-xs text-gray-500">If AI assessors fail to reach consensus or voice transcription is ambiguous, automatically escalate</div>
              </div>
            </label>
          </div>
        </div>

        <div className="border-t pt-4 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm"
          >
            <Save className="h-4 w-4" /> Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
