// ── Domain types mirrored from backend ────────────────────────────────────

export type Role = 'employee' | 'admin';
export type AuthProvider = 'local' | 'azure';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half-day';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'with_salary' | 'without_salary';
export type LeavePeriod = 'full_day' | 'half_day_morning' | 'half_day_afternoon';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}

export interface AttendanceRecord {
  _id: string;
  userId: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: AttendanceStatus;
  notes: string;
}

export interface LeaveRequest {
  _id: string;
  userId: string | { _id: string; fullName: string; email: string };
  date: string;
  leaveType: LeaveType;
  period: LeavePeriod;
  reason: string;
  status: LeaveStatus;
  createdAt: string;
}

// ── Payroll — Enterprise Edition ──────────────────────────────────────────

export interface Department {
  _id: string;
  name: string;
  code: string;        // e.g. "ENG", "HR"
  locationCode: string;
  country: string;
  currency: string;
}

export interface OvertimePolicy {
  _id: string;
  name: string;
  description: string;
  dailyThresholdHours: number;
  dailyOTRate: number;
  weeklyThresholdHours: number;
  weeklyOTRate: number;
  weekendRate: number;
  holidayRate: number;
  maxOTHoursPerMonth: number | null;
}

export type PayType = 'hourly' | 'salaried' | 'contract';
export type ProfileStatus = 'draft' | 'active' | 'superseded';
export type ValueType = 'fixed' | 'percent_of_base' | 'percent_of_gross';

export interface AllowanceDeductionItem {
  name: string;
  type: 'allowance' | 'deduction';
  category: string;
  valueType: ValueType;
  value: number;
  taxable: boolean;
  recurring: boolean;
}

/** Versioned pay configuration for one employee */
export interface EmployeePayProfile {
  _id: string;
  userId: string;
  payType: PayType;
  department: string;
  jobTitle: string;
  grade: string;
  baseHourlyRate?: number;
  monthlySalary?: number;
  contractAmount?: number;
  currency: string;
  overtimePolicyId?: string;
  allowances: AllowanceDeductionItem[];
  deductions: AllowanceDeductionItem[];
  effectiveFrom: string;
  effectiveTo?: string;
  status: ProfileStatus;
  notes?: string;
  createdAt: string;
}

export interface EmployeeProfileListItem {
  employee: { _id: string; fullName: string; email: string };
  profile: EmployeePayProfile | null;
}

export interface RunEntryAllowanceItem { name: string; amount: number; taxable: boolean; }
export interface RunEntryDeductionItem { name: string; amount: number; }

export interface PayrollRunEntry {
  userId: string;
  profileId?: string;
  hasProfile: boolean;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  payType: string;
  currency: string;
  // Work
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
  allowanceItems: RunEntryAllowanceItem[];
  deductionItems: RunEntryDeductionItem[];
  // Vietnam statutory deductions
  numberOfDependents: number;
  insurableSalary: number;
  bhxhEmployee: number;
  bhytEmployee: number;
  bhtnEmployee: number;
  totalInsuranceEmployee: number;
  bhxhEmployer: number;
  bhytEmployer: number;
  bhtnEmployer: number;
  totalInsuranceEmployer: number;
  personalRelief: number;
  dependentRelief: number;
  taxableIncome: number;
  pitAmount: number;
  totalStatutoryDeductions: number;
  // Admin
  status: 'calculated' | 'adjusted' | 'locked';
  adjustmentNote?: string;
  manualAdjustment?: number;
}

export type RunStatus = 'draft' | 'under_review' | 'approved' | 'exported';

export interface PayrollRun {
  _id: string;
  year: number;
  month: number;
  status: RunStatus;
  entries: PayrollRunEntry[];
  totalGrossPay: number;
  totalDeductions: number;
  totalNetPay: number;
  employeeCount: number;
  currency: string;
  createdAt: string;
  approvedAt?: string;
  notes?: string;
}

