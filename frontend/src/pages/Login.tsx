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
            <h1 className="text-4xl font-bold text-gray-900">PulseFlow</h1>
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
                placeholder="Enter your email"
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
      <div className="hidden w-1/2 lg:block relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-500 to-cyan-400">
        {/* Animated gradient mesh */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-500/20 to-cyan-400/20" style={{
            backgroundSize: '400% 400%',
            animation: 'gradient 15s ease infinite'
          }}></div>
        </div>

        {/* Floating blobs */}
        <div className="absolute top-10 right-10 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-8 -left-8 w-72 h-72 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/4 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '4s' }}></div>

        {/* Diagonal stripes pattern */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(255, 255, 255, 0.05) 15px, rgba(255, 255, 255, 0.05) 30px)'
        }}></div>

        {/* Curved decorative shapes */}
        <svg className="absolute inset-0 h-full w-full opacity-10" viewBox="0 0 400 800" preserveAspectRatio="none">
          <defs>
            <linearGradient id="shapeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 0.3)" />
              <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
            </linearGradient>
          </defs>
          <path
            d="M 0 200 Q 100 150 200 180 T 400 200 L 400 0 L 0 0 Z"
            fill="url(#shapeGrad)"
          />
          <path
            d="M 0 600 Q 100 550 200 580 T 400 600 L 400 800 L 0 800 Z"
            fill="url(#shapeGrad)"
          />
          <circle cx="100" cy="300" r="80" fill="rgba(255, 255, 255, 0.1)" />
          <circle cx="300" cy="500" r="60" fill="rgba(255, 255, 255, 0.08)" />
        </svg>

        {/* Center content with enhanced styling */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-center z-10">
            {/* Animated icon container */}
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full border-2 border-white/40 bg-white/10 backdrop-blur-sm animate-bounce">
              <span className="text-4xl">⚡</span>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2">PulseFlow</h2>
            <p className="text-white/70 text-sm font-medium">Enterprise Workforce Management</p>
          </div>
        </div>

        {/* Shine effect */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.1) 50%, transparent 70%)',
          animation: 'shine 3s infinite'
        }}></div>

        {/* CSS animations */}
        <style>{`
          @keyframes gradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes shine {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    </div>
  );
}
