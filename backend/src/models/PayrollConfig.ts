import { Schema, model, Document, Types } from 'mongoose';

/**
 * Per-employee payroll configuration.
 * - baseHourlyRate: base pay per hour (e.g. USD / VND)
 * - multiplier: personal coefficient applied on top (e.g. 1.5 for senior)
 * - overtimeMultiplier: rate applied for hours beyond standardHoursPerDay
 * - jobTitle: human-readable position label
 * - currency: display label for exports
 */
export interface IPayrollConfigDocument extends Document {
  userId: Types.ObjectId;
  jobTitle: string;
  baseHourlyRate: number;       // base pay per hour
  multiplier: number;           // personal coefficient  (default 1.0)
  overtimeMultiplier: number;   // overtime coefficient  (default 1.5)
  currency: string;             // e.g. "VND", "USD"
  createdAt: Date;
  updatedAt: Date;
}

const payrollConfigSchema = new Schema<IPayrollConfigDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    jobTitle: { type: String, default: 'Employee', trim: true },
    baseHourlyRate: { type: Number, required: true, min: 0 },
    multiplier: { type: Number, default: 1.0, min: 0 },
    overtimeMultiplier: { type: Number, default: 1.5, min: 1 },
    currency: { type: String, default: 'VND', trim: true },
  },
  { timestamps: true },
);

export const PayrollConfig = model<IPayrollConfigDocument>('PayrollConfig', payrollConfigSchema);
