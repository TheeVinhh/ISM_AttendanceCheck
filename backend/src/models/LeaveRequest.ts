import { Schema, model, Document, Types } from 'mongoose';
import type { LeaveStatus } from '../types';

export type LeaveType = 'with_salary' | 'without_salary';
export type LeavePeriod = 'full_day' | 'half_day_morning' | 'half_day_afternoon';

export interface ILeaveRequestDocument extends Document {
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  leaveType: LeaveType; // with_salary (12 days/year) or without_salary (31 days/year)
  period: LeavePeriod; // full_day, half_day_morning, half_day_afternoon
  reason: string;
  status: LeaveStatus;
  reviewedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequestDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    leaveType: {
      type: String,
      enum: ['with_salary', 'without_salary'],
      default: 'with_salary',
      required: true,
    },
    period: {
      type: String,
      enum: ['full_day', 'half_day_morning', 'half_day_afternoon'],
      default: 'full_day',
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const LeaveRequest = model<ILeaveRequestDocument>('LeaveRequest', leaveRequestSchema);
