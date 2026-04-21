import { Request, Response } from 'express';
import jwksRsa from 'jwks-rsa';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { User } from '../models/User';
import type { JwtPayload } from '../types';

// ── Azure AD ID-token claims we care about ────────────────────────────────
interface AzureIdTokenClaims {
  oid: string;          // Object ID – stable user identifier in the tenant
  name: string;         // Display name
  preferred_username?: string;
  email?: string;
  aud: string;
  iss: string;
  tid: string;
}

// ── JWKS client (lazy singleton, created after env is loaded) ─────────────
let _jwksClient: ReturnType<typeof jwksRsa> | null = null;

const getJwksClient = (): ReturnType<typeof jwksRsa> => {
  if (!_jwksClient) {
    _jwksClient = jwksRsa({
      jwksUri: `https://login.microsoftonline.com/${process.env['AZURE_TENANT_ID']}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 10 * 60 * 1000, // 10 minutes
    });
  }
  return _jwksClient;
};

const resolveSigningKey = (kid: string): Promise<string> =>
  new Promise((resolve, reject) => {
    getJwksClient().getSigningKey(kid, (err, key) => {
      if (err || !key) return reject(err ?? new Error('Signing key not found'));
      resolve(key.getPublicKey());
    });
  });

// ── POST /api/auth/azure ──────────────────────────────────────────────────
export const azureLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = process.env['AZURE_CLIENT_ID'];
    const tenantId = process.env['AZURE_TENANT_ID'];

    if (!clientId || !tenantId || clientId.startsWith('YOUR_')) {
      res.status(503).json({ message: 'Azure SSO is not configured on this server' });
      return;
    }

    const { idToken } = req.body as { idToken?: string };
    if (!idToken) {
      res.status(400).json({ message: 'idToken is required' });
      return;
    }

    // Decode header to extract kid (Key ID)
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      res.status(401).json({ message: 'Invalid token format' });
      return;
    }

    // Fetch Microsoft's public key and verify signature + claims
    const signingKey = await resolveSigningKey(decoded.header.kid as string);

    const claims = jwt.verify(idToken, signingKey, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    }) as AzureIdTokenClaims;

    const email = (claims.email ?? claims.preferred_username ?? '').toLowerCase();
    if (!email) {
      res.status(401).json({ message: 'No email claim in Azure token' });
      return;
    }

    // Find existing user (any provider) or create a new Azure-backed user
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        fullName: claims.name ?? email,
        email,
        authProvider: 'azure',
        role: 'employee',
        passwordHash: null,
      });
    }

    // Issue our own application JWT
    const payload: JwtPayload = {
      id: (user._id as unknown as string).toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const opts: SignOptions = {
      expiresIn: (process.env['JWT_EXPIRES_IN'] ?? '7d') as SignOptions['expiresIn'],
    };
    const token = jwt.sign(payload, process.env['JWT_SECRET']!, opts);

    res.json({ token, user: payload });
  } catch (err) {
    console.error('Azure login error:', err);
    res.status(401).json({ message: 'Azure token validation failed' });
  }
};
