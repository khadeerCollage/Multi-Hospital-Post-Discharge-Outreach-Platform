'use client';
import { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Mail, 
  CheckCircle2, 
  XCircle,
  Building2, 
  RefreshCw, 
  Edit3, 
  Trash2, 
  X, 
  UserCheck, 
  Save,
  AlertTriangle
} from 'lucide-react';
import { fetchApi } from '@/lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [hospitals, setHospitals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Create Modal State
  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: '',
    email: '',
    password: 'demo123',
    role: 'hospital_admin',
    tenant_id: '',
  });

  // Edit Modal State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'hospital_admin',
    tenant_id: '',
    is_active: true,
  });

  // Delete Confirmation State
  const [deletingUser, setDeletingUser] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load current user from localStorage
  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) {
        const parsed = JSON.parse(u);
        setCurrentUserId(parsed.id);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [usersRes, hospRes] = await Promise.allSettled([
        fetchApi('/api/v1/users'),
        fetchApi('/api/v1/hospitals'),
      ]);

      const hospMap: Record<string, string> = {};
      if (hospRes.status === 'fulfilled') {
        const hItems = hospRes.value?.items || hospRes.value || [];
        hItems.forEach((h: any) => {
          hospMap[h.id] = h.name;
        });
        setHospitals(hospMap);
        if (hItems.length > 0 && !addForm.tenant_id) {
          setAddForm(prev => ({ ...prev, tenant_id: hItems[0].id }));
        }
      }

      if (usersRes.status === 'fulfilled') {
        const uList = Array.isArray(usersRes.value) ? usersRes.value : (usersRes.value?.items || []);
        setUsers(uList);
      } else {
        throw new Error(usersRes.reason?.message || 'Failed to load users');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading staff directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- CREATE USER ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload: any = {
        full_name: addForm.full_name,
        email: addForm.email,
        password: addForm.password,
        role: addForm.role,
        tenant_id: addForm.role === 'platform_admin' ? null : (addForm.tenant_id || null),
      };

      await fetchApi('/api/v1/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShowAdd(false);
      setAddForm({
        full_name: '',
        email: '',
        password: 'demo123',
        role: 'hospital_admin',
        tenant_id: Object.keys(hospitals)[0] || '',
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  // --- OPEN EDIT MODAL ---
  const openEdit = (user: any) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'hospital_admin',
      tenant_id: user.tenant_id || (Object.keys(hospitals)[0] || ''),
      is_active: user.is_active ?? true,
    });
  };

  // --- UPDATE USER ---
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUpdating(true);
    try {
      const payload: any = {
        full_name: editForm.full_name,
        email: editForm.email,
        role: editForm.role,
        tenant_id: editForm.role === 'platform_admin' ? null : (editForm.tenant_id || null),
        is_active: editForm.is_active,
      };

      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      await fetchApi(`/api/v1/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setEditingUser(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  // --- DELETE USER ---
  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsDeleting(true);
    try {
      await fetchApi(`/api/v1/users/${deletingUser.id}`, {
        method: 'DELETE',
      });
      setDeletingUser(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, { bg: string; label: string }> = {
      platform_admin: { bg: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Platform Admin' },
      hospital_admin: { bg: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Hospital Admin' },
      campaign_manager: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Campaign Manager' },
      clinical_reviewer: { bg: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Clinical Reviewer' },
    };
    const item = map[role] || { bg: 'bg-gray-100 text-gray-800 border-gray-200', label: role };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${item.bg}`}>
        {item.label}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-7 w-7 text-blue-600" />
            Staff & User Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Full user lifecycle management with multi-tenant Role-Based Access Control (RBAC)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="px-3.5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 text-sm font-medium transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> Add New User
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {/* CREATE MODAL / FORM */}
      {showAdd && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 mb-8 transition-all">
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" /> Provision New Staff Member
            </h2>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Full Name</label>
              <input
                required
                value={addForm.full_name}
                onChange={e => setAddForm({ ...addForm, full_name: e.target.value })}
                placeholder="Dr. Sarah Connor"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address</label>
              <input
                required
                type="email"
                value={addForm.email}
                onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                placeholder="s.connor@citygeneral.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Role</label>
              <select
                value={addForm.role}
                onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="hospital_admin">Hospital Admin</option>
                <option value="campaign_manager">Campaign Manager</option>
                <option value="clinical_reviewer">Clinical Reviewer</option>
                <option value="platform_admin">Platform Admin (Global)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Assigned Hospital Tenant</label>
              <select
                disabled={addForm.role === 'platform_admin'}
                value={addForm.tenant_id}
                onChange={e => setAddForm({ ...addForm, tenant_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400"
              >
                {Object.entries(hospitals).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Initial Password</label>
              <input
                required
                type="text"
                value={addForm.password}
                onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                {creating ? 'Saving...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-xl w-full">
            <div className="flex items-center justify-between mb-4 border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-blue-600" /> Edit User: {editingUser.full_name}
              </h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Full Name</label>
                <input
                  required
                  value={editForm.full_name}
                  onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Role</label>
                  <select
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="hospital_admin">Hospital Admin</option>
                    <option value="campaign_manager">Campaign Manager</option>
                    <option value="clinical_reviewer">Clinical Reviewer</option>
                    <option value="platform_admin">Platform Admin (Global)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Assigned Hospital</label>
                  <select
                    disabled={editForm.role === 'platform_admin'}
                    value={editForm.tenant_id}
                    onChange={e => setEditForm({ ...editForm, tenant_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100"
                  >
                    {Object.entries(hospitals).map(([id, name]) => (
                      <option key={id} value={id}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Change Password (optional)
                </label>
                <input
                  type="password"
                  placeholder="Leave blank to keep unchanged"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-800">Account Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {updating ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-md w-full">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-gray-900">Confirm User Deletion</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to remove <strong>{deletingUser.full_name}</strong> ({deletingUser.email})? 
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* USERS TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/50 flex flex-wrap justify-between items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Registered Users ({users.length})
          </span>
          <span className="text-xs text-gray-400">All demo accounts default password: demo123</span>
        </div>

        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Assigned Hospital</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading staff directory...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No users found in database.
                </td>
              </tr>
            ) : (
              users.map((u: any) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs uppercase">
                          {u.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'U'}
                        </div>
                        <div>
                          <div className="text-gray-900 font-medium flex items-center gap-1.5">
                            {u.full_name}
                            {isSelf && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">ID: {u.id?.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                      <span className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        {u.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(u.role)}
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      <div className="flex items-center gap-1.5 text-xs font-medium">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        {u.tenant_id ? (hospitals[u.tenant_id] || 'Hospital Tenant') : (
                          <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-semibold">
                            Global Platform (All Hospitals)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-700 font-semibold bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600 font-semibold bg-gray-100 px-2.5 py-1 rounded-full border border-gray-200">
                          <XCircle className="h-3.5 w-3.5 text-gray-400" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          title="Edit User"
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingUser(u)}
                          disabled={isSelf}
                          title={isSelf ? 'Cannot delete your own account' : 'Delete User'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isSelf 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
