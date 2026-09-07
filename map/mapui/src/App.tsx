import { useState, useEffect } from 'react';
import HospitalMap from './pages/HospitalMap';

const API_URL = (() => {
  const raw = (import.meta as any).env?.VITE_API_URL as string | undefined;
  if (!raw) return 'http://localhost:3000';
  try { return new URL(raw.startsWith('http') ? raw : `https://${raw}`).origin; } catch { return raw; }
})();

const TOKEN_KEY = 'dth_token';

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.status === 'success') {
        localStorage.setItem(TOKEN_KEY, data.token);
        onLogin();
      } else {
        setError(data.message || 'Sai tên đăng nhập hoặc mật khẩu');
      }
    } catch {
      setError('Không thể kết nối đến server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#F4F7F8] flex items-center justify-center font-sans p-4">
      <div className="bg-white border border-[#E1E7EA] rounded-2xl p-10 w-full max-w-sm shadow-lg">
        <div className="flex items-center gap-2.5 mb-8">
          <span className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse" />
          <h1 className="font-bold text-[#0F2027] text-lg tracking-tight">Smart Hospital</h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#64777E] uppercase tracking-wide mb-1.5">
              Tên đăng nhập
            </label>
            <input
              type="text" required autoFocus
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="username"
              className="w-full px-3 py-2.5 border border-[#E1E7EA] rounded-lg text-sm font-mono bg-[#FAFBFB] outline-none focus:border-[#0E6E6E] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#64777E] uppercase tracking-wide mb-1.5">
              Mật khẩu
            </label>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-[#E1E7EA] rounded-lg text-sm font-mono bg-[#FAFBFB] outline-none focus:border-[#0E6E6E] transition-colors"
            />
          </div>
          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#0E6E6E] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setAuthed(false); return; }
    // Verify token với backend
    fetch(`${API_URL}/api/auth/verify`, {
      headers: { 'x-auth-token': token },
      credentials: 'include',
    })
      .then(r => r.json())
      .then(d => setAuthed(d.status === 'success'))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return null; // loading

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;

  return <HospitalMap />;
}
