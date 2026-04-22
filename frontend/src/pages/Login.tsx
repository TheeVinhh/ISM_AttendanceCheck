import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import MicrosoftLoginButton from '../components/MicrosoftLoginButton';
import type { AuthUser } from '../types';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string })?.message;
        setError(msg ?? 'Invalid email or password');
      } else {
        setError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  // Called by MicrosoftLoginButton after backend exchanges the Azure idToken
  const handleMicrosoftSuccess = (token: string, user: AuthUser) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    // Reload page so AuthContext picks up the stored values
    window.location.replace('/dashboard');
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Side - Form */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Logo & Branding */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">Sunpro</h1>
            <p className="mt-2 text-gray-600">Welcome back, please login to your account</p>
          </div>

          {/* SSO Button */}
          <div className="mb-6">
            <MicrosoftLoginButton
              onSuccess={handleMicrosoftSuccess}
              onError={(msg) => setError(msg)}
              label="Login with SSO"
            />
          </div>

          {/* Divider */}
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-medium text-gray-500">or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>

      {/* Right Side - Gradient Background */}
      <div className="hidden w-1/2 lg:block relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-500 to-cyan-400">
        {/* Diagonal stripes pattern */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255, 255, 255, 0.1) 10px, rgba(255, 255, 255, 0.1) 20px)'
        }}></div>
        
        {/* Curved shape */}
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 800" preserveAspectRatio="none">
          <path
            d="M 200 0 Q 350 200 350 400 Q 350 600 200 800 Q 50 600 50 400 Q 50 200 200 0"
            fill="rgba(255, 255, 255, 0.05)"
          />
        </svg>

        {/* Center logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/30">
              <span className="text-3xl">☀️</span>
            </div>
            <h2 className="text-3xl font-bold text-white">Sunpro</h2>
          </div>
        </div>
      </div>
    </div>
  );
}
