import { Schema, model, Document, Types } from 'mongoose';
import type { AttendanceStatus } from '../types';

export interface IAttendanceDocument extends Document {
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  checkInTime: Date | null;
  checkOutTime: Date | null;
  status: AttendanceStatus;
  notes: string;
  // OT assignment by admin
  otAssignedByAdmin: boolean; // Is this day assigned as OT by admin?
  otAssignedCheckOutTime?: string; // Admin-set checkout time (HH:MM format)
  otAssignedBy?: Types.ObjectId; // Admin user who assigned the OT
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
    // OT fields
    otAssignedByAdmin: { type: Boolean, default: false },
    otAssignedCheckOutTime: { type: String, default: undefined }, // HH:MM format
    otAssignedBy: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
  },
  { timestamps: true },
);

// One record per user per day
attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Attendance = model<IAttendanceDocument>('Attendance', attendanceSchema);
