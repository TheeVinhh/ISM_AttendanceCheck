import { Schema, model, Document, Types } from 'mongoose';

export type PayType = 'hourly' | 'salaried' | 'contract';
export type ProfileStatus = 'draft' | 'active' | 'superseded';
export type ValueType = 'fixed' | 'percent_of_base' | 'percent_of_gross';

/**
 * An allowance (positive component) or deduction (negative component).
 * value is either an absolute currency amount or a % depending on valueType.
 */
export interface IAllowanceDeductionItem {
  name: string;
  type: 'allowance' | 'deduction';
  category: string; // e.g. "transport", "housing", "meal", "tax", "insurance", "other"
  valueType: ValueType;
  value: number;    // absolute amount or percentage (e.g. 5 = 5%)
  taxable: boolean; // does this component attract income tax?
  recurring: boolean; // if false it is a one-time item (bonus / advance)
}

/**
 * Versioned pay configuration for one employee.
 * A new version is created when pay changes; old version gets effectiveTo set.
 */
export interface IEmployeePayProfileDocument extends Document {
  userId: Types.ObjectId;
  payType: PayType;
  department: string;  // department code or freeform name
  jobTitle: string;
  grade: string;       // pay grade label e.g. "L3", "Senior", "Grade B"

  // Only one of these is used, depending on payType
  baseHourlyRate?: number;   // hourly: pay per hour
  monthlySalary?: number;    // salaried: gross monthly salary (pro-rated for absences)
  contractAmount?: number;   // contract: fixed amount per payroll period

  currency: string;
  overtimePolicyId?: Types.ObjectId;

  // Vietnam compliance
  numberOfDependents: number;  // for PIT dependent relief (4.4M VND each)
  insuranceSalaryOverride?: number; // override insurable salary (e.g. contract workers)

  allowances: IAllowanceDeductionItem[];
  deductions: IAllowanceDeductionItem[];

  // Versioning
  effectiveFrom: Date;
  effectiveTo?: Date; // null = currently active

  status: ProfileStatus;
  notes?: string;

  // Audit
  createdBy: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IAllowanceDeductionItem>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['allowance', 'deduction'], required: true },
    category: { type: String, default: 'other' },
    valueType: { type: String, enum: ['fixed', 'percent_of_base', 'percent_of_gross'], required: true },
    value: { type: Number, required: true, min: 0 },
    taxable: { type: Boolean, default: false },
    recurring: { type: Boolean, default: true },
  },
  { _id: false },
);

const employeePayProfileSchema = new Schema<IEmployeePayProfileDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    payType: { type: String, enum: ['hourly', 'salaried', 'contract'], required: true },
    department: { type: String, default: '' },
    jobTitle: { type: String, default: 'Employee', trim: true },
    grade: { type: String, default: '' },
    baseHourlyRate: { type: Number, min: 0 },
    monthlySalary: { type: Number, min: 0 },
    contractAmount: { type: Number, min: 0 },
    currency: { type: String, default: 'VND' },
    overtimePolicyId: { type: Schema.Types.ObjectId, ref: 'OvertimePolicy' },
    numberOfDependents: { type: Number, default: 0, min: 0 },
    insuranceSalaryOverride: { type: Number, min: 0 },
    allowances: [itemSchema],
    deductions: [itemSchema],
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    status: { type: String, enum: ['draft', 'active', 'superseded'], default: 'active' },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  { timestamps: true },
);

// Fast lookup: active profile for a user ordered by most recent effectiveFrom
employeePayProfileSchema.index({ userId: 1, status: 1, effectiveFrom: -1 });

export const EmployeePayProfile = model<IEmployeePayProfileDocument>(
  'EmployeePayProfile',
  employeePayProfileSchema,
);
