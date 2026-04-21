import { Schema, model, Document, Types } from 'mongoose';
import type { AttendanceStatus } from '../types';

export interface IAttendanceDocument extends Document {
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  checkInTime: Date | null;
  checkOutTime: Date | null;
  status: AttendanceStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendanceDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half-day'],
      default: 'absent',
    },
    notes: { type: String, default: '' },
  },
  { timestamps: true },
);

// One record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Attendance = model<IAttendanceDocument>('Attendance', attendanceSchema);
