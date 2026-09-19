'use client';
import { useState, useEffect } from 'react';
import { Building2, Plus, ArrowLeft } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { clinicalToast } from '@/lib/toast';
import Link from 'next/link';

export default function AdminHospitalsPage() {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    phone: '',
    address: '',
    timezone: 'America/New_York',
    calling_hours_start: '09:00',
    calling_hours_end: '18:00',
    max_concurrent_calls: 10
  });

  const loadHospitals = async () => {
    try {
      setLoading(true);
      const data = await fetchApi('/api/v1/hospitals');
      setHospitals(data?.items || data || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch hospitals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHospitals();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await fetchApi('/api/v1/hospitals', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setShowAdd(false);
      clinicalToast.success(`Hospital "${form.name}" registered successfully.`);
      setForm({
        name: '', code: '', phone: '', address: '',
        timezone: 'America/New_York', calling_hours_start: '09:00',
        calling_hours_end: '18:00', max_concurrent_calls: 10
      });
      loadHospitals();
    } catch (err: any) {
      clinicalToast.error(err.message || 'Failed to create hospital');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin" className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            Hospitals Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">Multi-tenant healthcare systems connected to the outreach network</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Hospital
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-4 mb-6">{error}</div>}

      {showAdd && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8 transition-all">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Register New Hospital</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Hospital Name</label>
              <input
                required
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                placeholder="St. Jude Memorial"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Hospital Code</label>
              <input
                required
                value={form.code}
                onChange={e => setForm({...form, code: e.target.value.toUpperCase()})}
                placeholder="ST_JUDE"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                placeholder="+1-555-400-0004"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Max Concurrent Calls</label>
              <input
                type="number"
                min="1"
                max="50"
                value={form.max_concurrent_calls}
                onChange={e => setForm({...form, max_concurrent_calls: parseInt(e.target.value) || 10})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Address</label>
              <input
                value={form.address}
                onChange={e => setForm({...form, address: e.target.value})}
                placeholder="700 Medical Center Blvd"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
              >
                Register
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hospitals Grid / List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Hospital</th>
              <th className="px-6 py-4">Tenant Code</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Concurrency Limit</th>
              <th className="px-6 py-4">Calling Hours</th>
              <th className="px-6 py-4">Timezone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Loading hospitals...</td></tr>
            ) : hospitals.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No hospitals found</td></tr>
            ) : (
              hospitals.map((h: any) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-gray-900">{h.name}</div>
                        <div className="text-xs text-gray-400 font-normal">{h.address || 'Address on file'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-blue-700 font-semibold">{h.code}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      {h.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-700">{h.max_concurrent_calls} concurrent calls</td>
                  <td className="px-6 py-4 text-gray-500">{h.calling_hours_start} - {h.calling_hours_end}</td>
                  <td className="px-6 py-4 text-gray-500">{h.timezone}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
