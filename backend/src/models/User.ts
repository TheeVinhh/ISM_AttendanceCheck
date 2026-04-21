import { Schema, model, Document } from 'mongoose';
import type { Role, AuthProvider } from '../types';

export interface IUserDocument extends Document {
  fullName: string;
  email: string;
  role: Role;
  authProvider: AuthProvider;
  passwordHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUserDocument>(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      immutable: true,
    },
    role: {
      type: String,
      enum: ['employee', 'admin'],
      default: 'employee',
    },
    authProvider: {
      type: String,
      enum: ['local', 'azure'],
      required: true,
    },
    passwordHash: { type: String, default: null },
  },
  { timestamps: true },
);

export const User = model<IUserDocument>('User', userSchema);
