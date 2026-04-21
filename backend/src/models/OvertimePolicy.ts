import { Schema, model, Document } from 'mongoose';

export interface IOvertimePolicyDocument extends Document {
  name: string;
  description: string;
  // Daily OT: hours beyond this threshold on a weekday trigger dailyOTRate
  dailyThresholdHours: number;
  dailyOTRate: number;        // e.g. 1.5
  // Weekly OT: cumulative hours beyond this trigger weeklyOTRate
  weeklyThresholdHours: number;
  weeklyOTRate: number;       // e.g. 1.5
  // Special rates
  weekendRate: number;        // multiplier for Saturday/Sunday work
  holidayRate: number;        // multiplier for public holiday work
  // Cap on OT hours per month (null = unlimited)
  maxOTHoursPerMonth: number | null;
}

const overtimePolicySchema = new Schema<IOvertimePolicyDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    dailyThresholdHours: { type: Number, default: 8, min: 0 },
    dailyOTRate: { type: Number, default: 1.5, min: 1 },
    weeklyThresholdHours: { type: Number, default: 40, min: 0 },
    weeklyOTRate: { type: Number, default: 1.5, min: 1 },
    weekendRate: { type: Number, default: 2.0, min: 0 },
    holidayRate: { type: Number, default: 3.0, min: 0 },
    maxOTHoursPerMonth: { type: Number, default: null },
  },
  { timestamps: true },
);

export const OvertimePolicy = model<IOvertimePolicyDocument>('OvertimePolicy', overtimePolicySchema);
