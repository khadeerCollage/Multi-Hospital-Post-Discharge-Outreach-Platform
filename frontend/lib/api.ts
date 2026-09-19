const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

// Global request state tracking
let activeRequestsCount = 0;
type RequestListener = (count: number) => void;
const listeners = new Set<RequestListener>();

export function subscribeToNetworkActivity(listener: RequestListener) {
  listeners.add(listener);
  listener(activeRequestsCount);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach(fn => fn(activeRequestsCount));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('mhpdop:network-activity', {
        detail: { count: activeRequestsCount },
      })
    );
  }
}

export function getActiveRequestsCount() {
  return activeRequestsCount;
}

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  activeRequestsCount++;
  notifyListeners();

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      cache: 'no-store',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const errText = await res.text();
      let errMsg = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.detail) {
          errMsg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail);
        }
      } catch {}
      throw new Error(errMsg || `Request failed with status ${res.status}`);
    }

    return await res.json();
  } finally {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    notifyListeners();
  }
}