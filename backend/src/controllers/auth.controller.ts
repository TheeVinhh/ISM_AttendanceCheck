import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { User } from '../models/User';
import type { JwtPayload, Role } from '../types';

const signToken = (payload: JwtPayload): string => {
  const opts: SignOptions = { expiresIn: (process.env['JWT_EXPIRES_IN'] ?? '7d') as SignOptions['expiresIn'] };
  return jwt.sign(payload, process.env['JWT_SECRET']!, opts);
};

// POST /api/auth/register
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, password, role } = req.body as {
      fullName?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!fullName || !email || !password) {
      res.status(400).json({ message: 'fullName, email, and password are required' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ message: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const safeRole: Role = role === 'admin' ? 'admin' : 'employee';

    const user = await User.create({
      fullName: fullName.trim(),
      email,
      passwordHash,
      role: safeRole,
      authProvider: 'local',
    });

    const payload: JwtPayload = {
      id: (user._id as unknown as string).toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const token = signToken(payload);
    res.status(201).json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase(), authProvider: 'local' });
    if (!user || !user.passwordHash) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const payload: JwtPayload = {
      id: (user._id as unknown as string).toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    const token = signToken(payload);
    res.json({ token, user: payload });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/auth/me  (protected)
export const getMe = (req: Request, res: Response): void => {
  res.json({ user: req.user });
};
