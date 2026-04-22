import { useState } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import axios from 'axios';
import api from '../api/axios';
import { msalConfig, loginRequest } from '../config/msalConfig';
import type { AuthUser } from '../types';

interface Props {
  onSuccess: (token: string, user: AuthUser) => void;
  onError: (message: string) => void;
  label?: string;
}

// Singleton MSAL instance – one per app lifecycle
let _msal: PublicClientApplication | null = null;
let _initPromise: Promise<void> | null = null;

const getMsal = (): { instance: PublicClientApplication; ready: Promise<void> } => {
  if (!_msal) {
    _msal = new PublicClientApplication(msalConfig);
    _initPromise = _msal.initialize();
  }
  return { instance: _msal, ready: _initPromise! };
};

export default function MicrosoftLoginButton({ onSuccess, onError, label = 'Continue with Microsoft' }: Props) {
  const [loading, setLoading] = useState(false);

  const isConfigured =
    Boolean(import.meta.env['VITE_AZURE_CLIENT_ID']) &&
    !String(import.meta.env['VITE_AZURE_CLIENT_ID']).startsWith('YOUR_');

  const handleLogin = async () => {
    if (!isConfigured) {
      onError('Azure SSO is not yet configured. Add VITE_AZURE_CLIENT_ID and VITE_AZURE_TENANT_ID to .env');
      return;
    }

    setLoading(true);
    try {
      const { instance, ready } = getMsal();
      await ready; // ensure MSAL is fully initialized

      const result = await instance.loginPopup(loginRequest);

      // Exchange Azure ID token for our application JWT
      const { data } = await api.post<{ token: string; user: AuthUser }>('/auth/azure', {
        idToken: result.idToken,
      });

      onSuccess(data.token, data.user);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { message?: string })?.message;
        onError(msg ?? 'Microsoft sign-in failed');
      } else if (err instanceof Error) {
        // Ignore user-cancelled popup
        if (
          !err.message.includes('user_cancelled') &&
          !err.message.includes('popup_window_error') &&
          !err.message.includes('BrowserAuthError')
        ) {
          onError(err.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogin}
      disabled={loading}
      className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
    >
      {/* Microsoft four-square logo */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21" width="18" height="18" aria-hidden="true">
        <rect x="0" y="0" width="10" height="10" fill="#f25022" />
        <rect x="11" y="0" width="10" height="10" fill="#7fba00" />
        <rect x="0" y="11" width="10" height="10" fill="#00a4ef" />
        <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
      </svg>
      {loading ? 'Signing in…' : label}
    </button>
  );
}
