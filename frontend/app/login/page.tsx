'use client';
import { useState } from 'react';
import Link from 'next/link';
import { fetchApi } from '@/lib/api';
import { ArrowRight, Lock, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const data = await fetchApi('/api/v1/auth/login/json', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      const role = data.user.role;
      if (role === 'platform_admin') window.location.href = '/admin';
      else if (role === 'hospital_admin') window.location.href = '/dashboard';
      else if (role === 'campaign_manager') window.location.href = '/campaigns';
      else if (role === 'clinical_reviewer') window.location.href = '/escalations';
      else window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen w-screen max-h-screen overflow-hidden bg-gradient-to-r from-[#eef7fd] via-[#f5faff] to-[#dbeef8] select-none">
      {/* 1. Ambient blurred background fill */}
      <img
        src="/auth-widescreen.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50 scale-105 pointer-events-none"
      />

      {/* 2. Main Widescreen Artwork (Fit Height, Anchored Left, 100% Full Logo & Stats Visible) */}
      <div className="absolute inset-0 w-full h-full flex items-center justify-start overflow-hidden pointer-events-none py-2 sm:py-2.5 lg:py-3 pl-2 sm:pl-4 lg:pl-6 pr-0">
        <img
          src="/auth-widescreen.png"
          alt="CareReach - Continuing Care Beyond the Hospital"
          className="h-full w-auto max-w-none object-contain object-left drop-shadow-md rounded-2xl"
        />
      </div>

      {/* 3. Authentication Form Overlay - Positioned over the right-side gap */}
      <div className="relative z-10 h-full w-full flex items-center justify-center lg:justify-end px-4 sm:px-8 lg:px-12 xl:px-20">
        <div className="w-full max-w-[400px] lg:max-w-[410px] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/80 p-5 sm:p-6 space-y-3 my-auto">
          {/* Header */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 mb-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse"></span>
              CareReach™ Outreach Network
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
              Clinical Staff Sign In
            </h1>
            <p className="text-xs text-gray-500">
              Access real-time patient queues, outreach cadences & triage escalations.
            </p>
          </div>

          {/* Form */}
          <form className="space-y-3" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-2.5 font-medium flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-600 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2.5">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1">
                  Hospital Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="block w-full pl-9 pr-3.5 py-2 border border-gray-300 rounded-lg placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-2xs transition-all bg-white"
                    placeholder="doctor@hospital.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1">
                  Account Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="block w-full pl-9 pr-3.5 py-2 border border-gray-300 rounded-lg placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-2xs transition-all bg-white"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-md shadow-blue-500/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 transition-all cursor-pointer"
            >
              {loading ? 'Authenticating...' : 'Sign in to Console'}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {/* Link to Signup */}
          <div className="text-center pt-2 border-t border-gray-200/80">
            <p className="text-xs text-gray-500">
              Need new staff or clinician access?{' '}
              <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                Create an account
              </Link>
            </p>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-gray-400 pt-1 border-t border-gray-100">
            CareReach™ Multi-Hospital Platform • HIPAA-Compliant Outreach
          </div>
        </div>
      </div>
    </div>
  );
}