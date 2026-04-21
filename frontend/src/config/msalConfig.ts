import { type Configuration, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env['VITE_AZURE_CLIENT_ID'] as string,
    authority: `https://login.microsoftonline.com/${import.meta.env['VITE_AZURE_TENANT_ID'] as string}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) return;
        if (_level === LogLevel.Error) console.error('[MSAL]', message);
      },
    },
  },
};

// Scopes required for the ID token to contain name + email claims
export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};
