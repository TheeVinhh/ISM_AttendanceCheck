import { Schema, model, Document, Types } from 'mongoose';

export type RunStatus = 'draft' | 'under_review' | 'approved' | 'exported';
export type EntryStatus = 'calculated' | 'adjusted' | 'locked';

export interface IPayrollEntryAllowanceItem {
  name: string;
  amount: number;
  taxable: boolean;
}

export interface IPayrollEntryDeductionItem {
  name: string;
  amount: number;
}

/** Per-employee result embedded inside a PayrollRun document */
export interface IPayrollEntry {
  userId: Types.ObjectId;
  profileId?: Types.ObjectId;
  hasProfile: boolean;

  // Snapshot fields (so they don't change if profile is later edited)
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  payType: string;
  currency: string;

  // Work summary
  workingDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  regularHours: number;
  overtimeHours: number;
  weekendHours: number;

  // Pay breakdown
  basePay: number;
  overtimePay: number;
  allowancesTotal: number;
  deductionsTotal: number;
  grossPay: number;
  netPay: number;

  // Vietnam statutory deductions (employee share)
  numberOfDependents: number;
  insurableSalary: number;       // gross capped at insurance ceiling
  bhxhEmployee: number;          // Social Insurance 8%
  bhytEmployee: number;          // Health Insurance 1.5%
  bhtnEmployee: number;          // Unemployment Insurance 1%
  totalInsuranceEmployee: number; // 10.5% total
  // Employer contributions (informational, not deducted from net)
  bhxhEmployer: number;          // 17.5%
  bhytEmployer: number;          // 3%
  bhtnEmployer: number;          // 1%
  totalInsuranceEmployer: number;
  // PIT calculation
  personalRelief: number;        // 11,000,000 VND
  dependentRelief: number;       // dependents x 4,400,000 VND
  taxableIncome: number;         // gross - insurance - reliefs
  pitAmount: number;             // progressive tax
  totalStatutoryDeductions: number; // insurance + PIT

  // Itemised detail
  allowanceItems: IPayrollEntryAllowanceItem[];
  deductionItems: IPayrollEntryDeductionItem[];

  // Admin overrides
  status: EntryStatus;
  adjustmentNote?: string;
  manualAdjustment?: number; // if set, replaces netPay
}

export interface IPayrollRunDocument extends Document {
  year: number;
  month: number;
  status: RunStatus;
  entries: IPayrollEntry[];
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  employeeCount: number;
  currency: string; // primary display currency
  createdBy: Types.ObjectId;
  submittedForReviewAt?: Date;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  exportedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const allowanceItemSchema = new Schema<IPayrollEntryAllowanceItem>(
  { name: String, amount: Number, taxable: { type: Boolean, default: false } },
  { _id: false },
);

const deductionItemSchema = new Schema<IPayrollEntryDeductionItem>(
  { name: String, amount: Number },
  { _id: false },
);

const payrollEntrySchema = new Schema<IPayrollEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    profileId: { type: Schema.Types.ObjectId, ref: 'EmployeePayProfile' },
    hasProfile: { type: Boolean, default: false },
    fullName: { type: String, default: '' },
    email: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    department: { type: String, default: '' },
    payType: { type: String, default: '' },
    currency: { type: String, default: 'VND' },
    workingDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    lateDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    leaveDays: { type: Number, default: 0 },
    regularHours: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    weekendHours: { type: Number, default: 0 },
    basePay: { type: Number, default: 0 },
    overtimePay: { type: Number, default: 0 },
    allowancesTotal: { type: Number, default: 0 },
    deductionsTotal: { type: Number, default: 0 },
    grossPay: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    numberOfDependents: { type: Number, default: 0 },
    insurableSalary: { type: Number, default: 0 },
    bhxhEmployee: { type: Number, default: 0 },
    bhytEmployee: { type: Number, default: 0 },
    bhtnEmployee: { type: Number, default: 0 },
    totalInsuranceEmployee: { type: Number, default: 0 },
    bhxhEmployer: { type: Number, default: 0 },
    bhytEmployer: { type: Number, default: 0 },
    bhtnEmployer: { type: Number, default: 0 },
    totalInsuranceEmployer: { type: Number, default: 0 },
    personalRelief: { type: Number, default: 0 },
    dependentRelief: { type: Number, default: 0 },
    taxableIncome: { type: Number, default: 0 },
    pitAmount: { type: Number, default: 0 },
    totalStatutoryDeductions: { type: Number, default: 0 },
    allowanceItems: [allowanceItemSchema],
    deductionItems: [deductionItemSchema],
    status: { type: String, enum: ['calculated', 'adjusted', 'locked'], default: 'calculated' },
    adjustmentNote: String,
    manualAdjustment: Number,
  },
  { _id: false },
);

const payrollRunSchema = new Schema<IPayrollRunDocument>(
  {
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    status: {
      type: String,
      enum: ['draft', 'under_review', 'approved', 'exported'],
      default: 'draft',
    },
    entries: [payrollEntrySchema],
    totalGrossPay: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    totalNetPay: { type: Number, default: 0 },
    employeeCount: { type: Number, default: 0 },
    currency: { type: String, default: 'VND' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submittedForReviewAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    exportedAt: Date,
    notes: String,
  },
  { timestamps: true },
);

// One run per month (upsert-safe: allow recalculation of drafts)
payrollRunSchema.index({ year: 1, month: 1 });

export const PayrollRun = model<IPayrollRunDocument>('PayrollRun', payrollRunSchema);
