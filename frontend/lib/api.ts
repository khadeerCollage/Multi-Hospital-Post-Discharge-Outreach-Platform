const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
      throw new Error(await res.text());
    }

    return await res.json();
  } finally {
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    notifyListeners();
  }
}