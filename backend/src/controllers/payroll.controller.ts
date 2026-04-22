import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Department } from '../models/Department';
import { OvertimePolicy, IOvertimePolicyDocument } from '../models/OvertimePolicy';
import { EmployeePayProfile, IEmployeePayProfileDocument } from '../models/EmployeePayProfile';
import { PayrollRun } from '../models/PayrollRun';
// legacy PayrollConfig intentionally not imported â€” superseded by EmployeePayProfile
import { Attendance } from '../models/Attendance';
import { LeaveRequest } from '../models/LeaveRequest';
import { User } from '../models/User';
import { getWorkingHours } from '../models/WorkingHours';
import { nowGMT7 } from '../utils/timezone';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PRIVATE CALCULATION ENGINE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface WorkSummary {
  workingDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  regularHours: number;
  overtimeHours: number;
  weekendHours: number;
}

interface PayBreakdown {
  basePay: number;
  overtimePay: number;
  allowancesTotal: number;
  deductionsTotal: number;
  grossPay: number;
  netPay: number;
  allowanceItems: { name: string; amount: number; taxable: boolean }[];
  deductionItems: { name: string; amount: number }[];
  // Vietnam statutory fields
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
}

// ═══════════════════════════════════════════════════════════════════════════
// VIETNAM STATUTORY CONSTANTS (effective July 2024)
// ═══════════════════════════════════════════════════════════════════════════

/** Base salary (lương cơ sở) used as insurance ceiling: 2,340,000 VND */
const VN_BASE_SALARY = 2_340_000;
/** Social / Health insurance ceiling: 20 × base salary */
const VN_INSURANCE_CEILING = 20 * VN_BASE_SALARY; // 46,800,000 VND

// Employee insurance rates
const BHXH_EMP = 0.08;   // Social Insurance
const BHYT_EMP = 0.015;  // Health Insurance
const BHTN_EMP = 0.01;   // Unemployment Insurance

// Employer insurance rates (informational)
const BHXH_ER = 0.175;
const BHYT_ER = 0.03;
const BHTN_ER = 0.01;

/** Personal relief (giảm trừ bản thân): 11,000,000 VND/month */
const VN_PERSONAL_RELIEF = 11_000_000;
/** Dependent relief (giảm trừ người phụ thuộc): 4,400,000 VND/dependent/month */
const VN_DEPENDENT_RELIEF = 4_400_000;

/**
 * Vietnam progressive PIT brackets (monthly, Article 22 PIT Law 04/2007, amended).
 * Each bracket: [threshold, rate].
 * Tax = sum of tax in each bracket below taxable income.
 */
const VN_PIT_BRACKETS: { limit: number; rate: number }[] = [
  { limit: 5_000_000,  rate: 0.05 },
  { limit: 10_000_000, rate: 0.10 },
  { limit: 18_000_000, rate: 0.15 },
  { limit: 32_000_000, rate: 0.20 },
  { limit: 52_000_000, rate: 0.25 },
  { limit: 80_000_000, rate: 0.30 },
  { limit: Infinity,   rate: 0.35 },
];

/**
 * Calculate Vietnam progressive Personal Income Tax.
 * @param taxableIncome Monthly taxable income after all reliefs.
 */
const calcVnPIT = (taxableIncome: number): number => {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const { limit, rate } of VN_PIT_BRACKETS) {
    if (taxableIncome <= prev) break;
    const band = Math.min(taxableIncome, limit) - prev;
    tax += band * rate;
    prev = limit;
  }
  return Math.round(tax);
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Hours worked between two Date objects (capped to 0) */
const hoursWorked = (checkIn: Date, checkOut: Date): number =>
  Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 3_600_000);

interface WorkingConfig {
  standardHoursPerDay: number;
  /** Scheduled check-in time as "HH:mm" (GMT+7), used to clamp early arrivals */
  scheduledCheckInTime: string;
}

const getWorkingConfig = async (): Promise<WorkingConfig> => {
  const wh = await getWorkingHours();
  const [inH, inM] = wh.checkInTime.split(':').map(Number);
  const [outH, outM] = wh.checkOutTime.split(':').map(Number);
  return {
    standardHoursPerDay: (outH * 60 + outM - (inH * 60 + inM)) / 60,
    scheduledCheckInTime: wh.checkInTime,
  };
};

/**
 * Build a work summary for one employee in a given month.
 * Only counts elapsed working days (not future days) as potentially absent.
 */
const buildWorkSummary = async (
  userId: Types.ObjectId | string,
  year: number,
  month: number,
  standardHoursPerDay: number,
  scheduledCheckInTime: string,
): Promise<WorkSummary> => {
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = nowGMT7();

  // Parse scheduled check-in (GMT+7) for early-arrival clamping
  const [schH, schM] = scheduledCheckInTime.split(':').map(Number);

  const [records, approvedLeaves] = await Promise.all([
    Attendance.find({ userId, date: { $regex: `^${monthPrefix}` } }).lean(),
    LeaveRequest.find({ userId, date: { $regex: `^${monthPrefix}` }, status: 'approved' })
      .select('date')
      .lean(),
  ]);

  const recordDates = new Set(records.map((r) => r.date));
  const leaveDates = new Set(approvedLeaves.map((l) => l.date));

  let workingDays = 0;
  let absentDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow === 0 || dow === 6) continue;
    if (new Date(year, month - 1, d) > today) continue;
    workingDays++;
    const dateStr = `${monthPrefix}-${String(d).padStart(2, '0')}`;
    if (!recordDates.has(dateStr) && !leaveDates.has(dateStr)) absentDays++;
  }

  let regularHours = 0, overtimeHours = 0, weekendHours = 0;
  let presentDays = 0, lateDays = 0;
  const leaveDays = approvedLeaves.length;

  for (const rec of records) {
    const dow = new Date(rec.date + 'T00:00:00').getDay();
    const isWeekend = dow === 0 || dow === 6;
    if (!rec.checkInTime) continue;

    // Determine checkout time: use admin-assigned time if available, otherwise use actual checkout time
    let checkOutTime: Date | null = null;
    if (rec.otAssignedByAdmin && rec.otAssignedCheckOutTime) {
      // Use admin-assigned checkout time
      const [outH, outM] = rec.otAssignedCheckOutTime.split(':').map(Number);
      const [yr, mo, dy] = rec.date.split('-').map(Number);
      checkOutTime = new Date(Date.UTC(yr, mo - 1, dy, outH - 7, outM, 0, 0));
    } else {
      checkOutTime = rec.checkOutTime;
    }

    if (!checkOutTime) {
      if (!isWeekend) { rec.status === 'late' ? lateDays++ : presentDays++; }
      continue;
    }

    // Clamp effective check-in to the scheduled start time.
    // An employee who arrives early does not earn pay before the shift starts.
    // rec.date is "YYYY-MM-DD" in GMT+7. Scheduled check-in in UTC = schH - 7h on that date.
    const [yr, mo, dy] = rec.date.split('-').map(Number);
    const scheduledCheckInMs = Date.UTC(yr, mo - 1, dy, schH - 7, schM, 0, 0);
    const effectiveCheckIn = new Date(Math.max(rec.checkInTime.getTime(), scheduledCheckInMs));

    const worked = hoursWorked(effectiveCheckIn, checkOutTime);
    if (isWeekend) {
      weekendHours += worked;
    } else {
      regularHours += Math.min(worked, standardHoursPerDay);
      overtimeHours += Math.max(0, worked - standardHoursPerDay);
      rec.status === 'late' ? lateDays++ : presentDays++;
    }
  }

  return {
    workingDays, presentDays, lateDays, absentDays, leaveDays,
    regularHours: r2(regularHours), overtimeHours: r2(overtimeHours), weekendHours: r2(weekendHours),
  };
};

/**
 * Rule-based pay breakdown.
 * Order: basePay â†’ overtimePay â†’ allowances â†’ grossPay â†’ deductions â†’ netPay
 */
const computePayBreakdown = (
  profile: IEmployeePayProfileDocument,
  otPolicy: IOvertimePolicyDocument | null,
  workSummary: WorkSummary,
  standardHoursPerDay: number,
): PayBreakdown => {
  // 1. Base pay
  let basePay = 0;
  const paidDays = workSummary.presentDays + workSummary.lateDays + workSummary.leaveDays;
  switch (profile.payType) {
    case 'hourly':
      basePay = workSummary.regularHours * (profile.baseHourlyRate ?? 0);
      break;
    case 'salaried':
      basePay = workSummary.workingDays > 0
        ? (profile.monthlySalary ?? 0) * (paidDays / workSummary.workingDays)
        : (profile.monthlySalary ?? 0);
      break;
    case 'contract':
      basePay = profile.contractAmount ?? 0;
      break;
  }
  basePay = Math.round(basePay);

  // 2. Overtime pay
  let overtimePay = 0;
  if (otPolicy && profile.payType !== 'contract') {
    const effectiveHourlyRate = profile.payType === 'hourly'
      ? (profile.baseHourlyRate ?? 0)
      : (profile.monthlySalary ?? 0) / Math.max(workSummary.workingDays * standardHoursPerDay, 1);

    let otHours = workSummary.overtimeHours;
    if (otPolicy.maxOTHoursPerMonth != null) otHours = Math.min(otHours, otPolicy.maxOTHoursPerMonth);
    overtimePay += otHours * effectiveHourlyRate * otPolicy.dailyOTRate;
    overtimePay += workSummary.weekendHours * effectiveHourlyRate * otPolicy.weekendRate;
  }
  overtimePay = Math.round(overtimePay);

  // 3. Allowances — split taxable vs non-taxable for PIT exclusion
  const allowanceItems: { name: string; amount: number; taxable: boolean }[] = [];
  let allowancesTotal = 0;
  let nonTaxableAllowances = 0;
  const preDeductionBase = basePay + overtimePay;
  for (const item of profile.allowances) {
    let amount = item.valueType === 'fixed' ? item.value
      : item.valueType === 'percent_of_base' ? basePay * (item.value / 100)
      : preDeductionBase * (item.value / 100);
    amount = Math.round(amount);
    allowancesTotal += amount;
    if (!item.taxable) nonTaxableAllowances += amount;
    allowanceItems.push({ name: item.name, amount, taxable: item.taxable });
  }
  const grossPay = Math.round(basePay + overtimePay + allowancesTotal);

  // 4. Extra deductions (union fees, advances, etc.)
  const deductionItems: { name: string; amount: number }[] = [];
  let extraDeductions = 0;
  for (const item of profile.deductions) {
    let amount = item.valueType === 'fixed' ? item.value
      : item.valueType === 'percent_of_base' ? basePay * (item.value / 100)
      : grossPay * (item.value / 100);
    amount = Math.round(amount);
    extraDeductions += amount;
    deductionItems.push({ name: item.name, amount });
  }

  // 5. Vietnam mandatory insurance (employee share, capped at 20× base salary = 46.8M VND)
  const insurableSalary        = Math.min(profile.insuranceSalaryOverride ?? grossPay, VN_INSURANCE_CEILING);
  const bhxhEmployee           = Math.round(insurableSalary * BHXH_EMP);    // 8%
  const bhytEmployee           = Math.round(insurableSalary * BHYT_EMP);    // 1.5%
  const bhtnEmployee           = Math.round(insurableSalary * BHTN_EMP);    // 1%
  const totalInsuranceEmployee = bhxhEmployee + bhytEmployee + bhtnEmployee; // 10.5%
  // Employer contributions (for HR record only, not deducted from employee net)
  const bhxhEmployer           = Math.round(insurableSalary * BHXH_ER);     // 17.5%
  const bhytEmployer           = Math.round(insurableSalary * BHYT_ER);     // 3%
  const bhtnEmployer           = Math.round(insurableSalary * BHTN_ER);     // 1%
  const totalInsuranceEmployer = bhxhEmployer + bhytEmployer + bhtnEmployer;

  // 6. PIT progressive 5–35% (Vietnam PIT Law 04/2007, amended)
  const numberOfDependents = profile.numberOfDependents ?? 0;
  const personalRelief  = VN_PERSONAL_RELIEF;                               // 11,000,000
  const dependentRelief = numberOfDependents * VN_DEPENDENT_RELIEF;         // × 4,400,000
  const taxableIncome   = Math.max(
    0,
    grossPay - totalInsuranceEmployee - personalRelief - dependentRelief - nonTaxableAllowances,
  );
  const pitAmount = calcVnPIT(taxableIncome);

  // 7. Net pay
  const totalStatutoryDeductions = totalInsuranceEmployee + pitAmount;
  const deductionsTotal = totalStatutoryDeductions + extraDeductions;
  const netPay = Math.round(grossPay - deductionsTotal);

  return {
    basePay, overtimePay, allowancesTotal, deductionsTotal,
    grossPay, netPay,
    allowanceItems, deductionItems,
    numberOfDependents,
    insurableSalary, bhxhEmployee, bhytEmployee, bhtnEmployee, totalInsuranceEmployee,
    bhxhEmployer, bhytEmployer, bhtnEmployer, totalInsuranceEmployer,
    personalRelief, dependentRelief, taxableIncome, pitAmount, totalStatutoryDeductions,
  };
};

/** Find most recent ACTIVE profile covering a given month */
const getActiveProfile = async (
  userId: Types.ObjectId | string,
  year: number,
  month: number,
): Promise<IEmployeePayProfileDocument | null> => {
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);
  return EmployeePayProfile.findOne({
    userId, status: 'active',
    effectiveFrom: { $lte: periodEnd },
    $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: periodStart } }],
  }).sort({ effectiveFrom: -1 }).exec();
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DEPARTMENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const listDepartments = async (_req: Request, res: Response): Promise<void> => {
  try {
    const departments = await Department.find().sort({ name: 1 }).lean();
    res.json({ departments });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

export const upsertDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id?: string };
    const { name, code, locationCode, country, currency } = req.body as Record<string, string>;
    if (!name || !code) { res.status(400).json({ message: 'name and code are required' }); return; }
    let department;
    if (id) {
      department = await Department.findByIdAndUpdate(id, { name, code: code.toUpperCase(), locationCode, country, currency }, { new: true });
      if (!department) { res.status(404).json({ message: 'Department not found' }); return; }
    } else {
      department = await Department.create({ name, code: code.toUpperCase(), locationCode, country, currency });
    }
    res.json({ department });
  } catch (err: any) {
    if (err.code === 11000) res.status(409).json({ message: 'Department code already exists' });
    else res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

export const deleteDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    await Department.findByIdAndDelete(req.params['id']);
    res.json({ message: 'Department deleted' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// OVERTIME POLICIES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export const listOTPolicies = async (_req: Request, res: Response): Promise<void> => {
  try {
    const policies = await OvertimePolicy.find().sort({ name: 1 }).lean();
    res.json({ policies });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

export const upsertOTPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as { id?: string };
    const body = req.body as Partial<IOvertimePolicyDocument>;
    if (!body.name) { res.status(400).json({ message: 'name is required' }); return; }
    let policy;
    if (id) {
      policy = await OvertimePolicy.findByIdAndUpdate(id, body, { new: true });
      if (!policy) { res.status(404).json({ message: 'OT policy not found' }); return; }
    } else {
      policy = await OvertimePolicy.create(body);
    }
    res.json({ policy });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

export const deleteOTPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    await OvertimePolicy.findByIdAndDelete(req.params['id']);
    res.json({ message: 'OT policy deleted' });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EMPLOYEE PAY PROFILES (versioned)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/** GET /api/payroll/profiles â€” list all employees with their current active profile */
export const listProfiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { dept, payType } = req.query as { dept?: string; payType?: string };
    const employees = await User.find({ role: 'employee' }).select('fullName email').lean();
    const now = nowGMT7();

    const profiles = await EmployeePayProfile.find({
      userId: { $in: employees.map((e) => e._id) },
      status: 'active',
      effectiveFrom: { $lte: now },
      $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gte: now } }],
    }).sort({ effectiveFrom: -1 }).lean();

    const profileMap = new Map<string, typeof profiles[0]>();
    for (const p of profiles) {
      const key = String(p.userId);
      if (!profileMap.has(key)) profileMap.set(key, p);
    }

    let items = employees.map((emp) => ({
      employee: { _id: emp._id, fullName: emp.fullName, email: emp.email },
      profile: profileMap.get(String(emp._id)) ?? null,
    }));

    if (dept) items = items.filter((i) => i.profile?.department === dept);
    if (payType) items = items.filter((i) => i.profile?.payType === payType);

    res.json({ items });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

/** GET /api/payroll/profiles/:userId/history */
export const getUserProfileHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestedId = req.params['userId'];
    const callerId = req.user?.id ?? req.user?._id?.toString();
    // Employees may only view their own profile history
    if (req.user?.role !== 'admin' && requestedId !== callerId) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }
    const profiles = await EmployeePayProfile.find({ userId: requestedId })
      .sort({ effectiveFrom: -1 }).lean();
    res.json({ profiles });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

/**
 * POST /api/payroll/profiles/:userId â€” create a new versioned profile.
 * Automatically supersedes any currently active profile.
 */
export const createProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId: string };
    if (!req.body.effectiveFrom) { res.status(400).json({ message: 'effectiveFrom is required' }); return; }
    const validPayTypes = ['hourly', 'salaried', 'contract'];
    if (!req.body.payType || !validPayTypes.includes(req.body.payType as string)) {
      res.status(400).json({ message: `payType must be one of: ${validPayTypes.join(', ')}` }); return;
    }
    const employee = await User.findById(userId);
    if (!employee) { res.status(404).json({ message: 'Employee not found' }); return; }

    const effectiveFrom = new Date(req.body.effectiveFrom as string);

    // Supersede overlapping active profiles
    const existing = await EmployeePayProfile.find({ userId, status: 'active' });
    for (const old of existing) {
      const cutoff = new Date(effectiveFrom);
      cutoff.setDate(cutoff.getDate() - 1);
      await EmployeePayProfile.findByIdAndUpdate(old._id, { status: 'superseded', effectiveTo: cutoff });
    }

    const profile = await EmployeePayProfile.create({
      userId, effectiveFrom, status: 'active',
      payType: req.body.payType,
      department: req.body.department ?? '',
      jobTitle: req.body.jobTitle ?? 'Employee',
      grade: req.body.grade ?? '',
      baseHourlyRate: req.body.baseHourlyRate,
      monthlySalary: req.body.monthlySalary,
      contractAmount: req.body.contractAmount,
      currency: req.body.currency ?? 'VND',
      overtimePolicyId: req.body.overtimePolicyId ?? null,
      allowances: req.body.allowances ?? [],
      deductions: req.body.deductions ?? [],
      notes: req.body.notes ?? '',
      createdBy: req.user?.id,
    });

    res.status(201).json({ profile });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PAYROLL RUNS  (draft â†’ under_review â†’ approved â†’ exported)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/** GET /api/payroll/runs */
/** GET /api/payroll/runs – Admins see all; employees see only runs with their entry */
export const listPayrollRuns = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role === 'admin') {
      // Admins see all payroll runs (without detailed entries to save bandwidth)
      const runs = await PayrollRun.find().select('-entries').sort({ year: -1, month: -1 }).lean();
      res.json({ runs });
      return;
    }

    // Employees see only runs that contain their entry
    const userId = req.user?.id || req.user?._id?.toString();
    const runs = await PayrollRun.find(
      { 'entries.userId': new Types.ObjectId(userId) }
    ).select('-entries').sort({ year: -1, month: -1 }).lean();
    res.json({ runs });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

/** POST /api/payroll/runs â€” calculate and store a payroll run */
export const createPayrollRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = nowGMT7();
    const year = parseInt(String(req.body.year ?? now.getFullYear()), 10);
    const month = parseInt(String(req.body.month ?? now.getMonth() + 1), 10);

    if (isNaN(year) || year < 2000 || year > 2100) {
      res.status(400).json({ message: 'Invalid year. Must be between 2000 and 2100.' }); return;
    }
    if (isNaN(month) || month < 1 || month > 12) {
      res.status(400).json({ message: 'Invalid month. Must be between 1 and 12.' }); return;
    }
    const employees = await User.find({ role: 'employee' }).select('fullName email').lean();

    const entries = await Promise.all(employees.map(async (emp) => {
      const profile = await getActiveProfile(emp._id as Types.ObjectId, year, month);
      if (!profile) {
        return {
          userId: emp._id as Types.ObjectId, hasProfile: false,
          fullName: emp.fullName, email: emp.email,
          jobTitle: '', department: '', payType: '', currency: 'VND',
          workingDays: 0, presentDays: 0, lateDays: 0, absentDays: 0, leaveDays: 0,
          regularHours: 0, overtimeHours: 0, weekendHours: 0,
          basePay: 0, overtimePay: 0, allowancesTotal: 0, deductionsTotal: 0,
          grossPay: 0, netPay: 0, allowanceItems: [], deductionItems: [],
          numberOfDependents: 0,
          insurableSalary: 0, bhxhEmployee: 0, bhytEmployee: 0, bhtnEmployee: 0, totalInsuranceEmployee: 0,
          bhxhEmployer: 0, bhytEmployer: 0, bhtnEmployer: 0, totalInsuranceEmployer: 0,
          personalRelief: 0, dependentRelief: 0, taxableIncome: 0, pitAmount: 0, totalStatutoryDeductions: 0,
          status: 'calculated' as const,
        };
      }

      const otPolicy = profile.overtimePolicyId
        ? await OvertimePolicy.findById(profile.overtimePolicyId) : null;
      const workSummary = await buildWorkSummary(emp._id as Types.ObjectId, year, month, standardHoursPerDay, scheduledCheckInTime);
      const breakdown = computePayBreakdown(profile, otPolicy, workSummary, standardHoursPerDay);

      return {
        userId: emp._id as Types.ObjectId,
        profileId: profile._id as Types.ObjectId,
        hasProfile: true,
        fullName: emp.fullName, email: emp.email,
        jobTitle: profile.jobTitle, department: profile.department,
        payType: profile.payType, currency: profile.currency,
        ...workSummary, ...breakdown, status: 'calculated' as const,
      };
    }));

    const totalGrossPay = entries.reduce((s, e) => s + e.grossPay, 0);
    const totalDeductions = entries.reduce((s, e) => s + e.deductionsTotal, 0);
    const totalNetPay = entries.reduce((s, e) => s + e.netPay, 0);
    const primaryCurrency = entries.find((e) => e.hasProfile)?.currency ?? 'VND';

    let run;
    if (existing) {
      existing.set({ entries, totalGrossPay, totalDeductions, totalNetPay, employeeCount: employees.length, currency: primaryCurrency, status: 'draft' });
      run = await existing.save();
    } else {
      run = await PayrollRun.create({
        year, month, status: 'draft', entries,
        totalGrossPay, totalDeductions, totalNetPay,
        employeeCount: employees.length, currency: primaryCurrency,
        createdBy: req.user?.id,
      });
    }

    res.status(201).json({ run });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

/** GET /api/payroll/runs/:runId – Admins see all; employees see only their entry */
export const getPayrollRun = async (req: Request, res: Response): Promise<void> => {
  try {
    const run = await PayrollRun.findById(req.params['runId']).lean();
    if (!run) { res.status(404).json({ message: 'Run not found' }); return; }

    // For employees: filter to show only their entry
    if (req.user?.role !== 'admin') {
      const userId = req.user?.id || req.user?._id?.toString();
      const hasEntry = run.entries.some((e) => e.userId.toString() === userId);
      if (!hasEntry) {
        res.status(403).json({ message: 'You do not have access to this payroll run' });
        return;
      }
      // Return only their entry details
      const entry = run.entries.find((e) => e.userId.toString() === userId);
      res.json({ run: { ...run, entries: [entry] } });
      return;
    }

    res.json({ run });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

/** POST /api/payroll/runs/:runId/submit – draft → under_review (Admin only) */
export const submitRun = async (req: Request, res: Response): Promise<void> => {
  try {
    // Admin-only (enforced by middleware)
    const run = await PayrollRun.findById(req.params['runId']);
    if (!run) { res.status(404).json({ message: 'Run not found' }); return; }
    if (run.status !== 'draft') { res.status(409).json({ message: `Cannot submit a '${run.status}' run` }); return; }
    run.status = 'under_review';
    run.submittedForReviewAt = new Date();
    await run.save();
    res.json({ run });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

/** POST /api/payroll/runs/:runId/approve – under_review → approved (Admin only) */
export const approveRun = async (req: Request, res: Response): Promise<void> => {
  try {
    // Admin-only (enforced by middleware)
    const run = await PayrollRun.findById(req.params['runId']);
    if (!run) { res.status(404).json({ message: 'Run not found' }); return; }
    if (!['under_review', 'draft'].includes(run.status)) {
      res.status(409).json({ message: `Cannot approve a '${run.status}' run` }); return;
    }
    run.status = 'approved';
    run.approvedBy = new Types.ObjectId(req.user?.id);
    run.approvedAt = new Date();
    // Lock all entries so they cannot be edited after approval
    for (const e of run.entries) { if (e.status !== 'adjusted') e.status = 'locked'; }
    await run.save();
    res.json({ run });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

/** PUT /api/payroll/runs/:runId/entries/:userId â€” admin manual adjustment */
export const adjustEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { runId, userId } = req.params as { runId: string; userId: string };
    const run = await PayrollRun.findById(runId);
    if (!run) { res.status(404).json({ message: 'Run not found' }); return; }
    if (['approved', 'exported'].includes(run.status)) {
      res.status(409).json({ message: `Cannot adjust a '${run.status}' payroll run. Only draft or under-review runs may be adjusted.` });
      return;
    }
    const entry = run.entries.find((e) => String(e.userId) === userId);
    if (!entry) { res.status(404).json({ message: 'Entry not found' }); return; }
    entry.manualAdjustment = req.body.manualAdjustment;
    entry.adjustmentNote = req.body.adjustmentNote ?? '';
    entry.status = 'adjusted';
    run.totalNetPay = run.entries.reduce((s, e) => s + (e.manualAdjustment ?? e.netPay), 0);
    await run.save();
    res.json({ run });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

/** GET /api/payroll/runs/:runId/export-csv */
export const exportRunCSV = async (req: Request, res: Response): Promise<void> => {
  try {
    const run = await PayrollRun.findById(req.params['runId']);
    if (!run) { res.status(404).json({ message: 'Run not found' }); return; }
    const monthLabel = `${run.year}-${String(run.month).padStart(2, '0')}`;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const headers = ['Employee', 'Email', 'Dept', 'Pay Type', 'Job Title',
      'Working Days', 'Present', 'Late', 'Absent', 'Leave',
      'Regular Hrs', 'OT Hrs', 'Weekend Hrs',
      'Base Pay', 'OT Pay', 'Allowances', 'Deductions', 'Gross Pay', 'Net Pay',
      'Adjustment', 'Final Pay', 'Currency', 'Status'];

    const rows = run.entries.map((e) => {
      const final = e.manualAdjustment ?? e.netPay;
      return [e.fullName, e.email, e.department, e.payType, e.jobTitle,
        e.workingDays, e.presentDays, e.lateDays, e.absentDays, e.leaveDays,
        e.regularHours, e.overtimeHours, e.weekendHours,
        e.basePay, e.overtimePay, e.allowancesTotal, e.deductionsTotal, e.grossPay, e.netPay,
        e.manualAdjustment ?? '', final, e.currency, e.status,
      ].map(esc).join(',');
    });

    const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows].join('\r\n');

    if (run.status === 'approved') { run.status = 'exported'; run.exportedAt = new Date(); await run.save(); }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${monthLabel}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};


export const getMyPayslip = async (req: Request, res: Response): Promise<void> => {
  try {
    const run = await PayrollRun.findById(req.params['runId']).lean();
    if (!run) { res.status(404).json({ message: 'Payroll run not found' }); return; }

    const userId = req.user?.id || req.user?._id?.toString();
    const entry = run.entries.find((e) => e.userId.toString() === userId);

    if (!entry) {
      res.status(403).json({ message: 'You do not have an entry in this payroll run' });
      return;
    }

    res.json({
      payslip: {
        runId: run._id,
        year: run.year,
        month: run.month,
        status: run.status,
        approvedAt: run.approvedAt,
        entry: {
          fullName: entry.fullName,
          email: entry.email,
          jobTitle: entry.jobTitle,
          department: entry.department,
          payType: entry.payType,
          currency: entry.currency,
          workingDays: entry.workingDays,
          presentDays: entry.presentDays,
          lateDays: entry.lateDays,
          absentDays: entry.absentDays,
          leaveDays: entry.leaveDays,
          regularHours: entry.regularHours,
          overtimeHours: entry.overtimeHours,
          weekendHours: entry.weekendHours,
          basePay: entry.basePay,
          overtimePay: entry.overtimePay,
          allowancesTotal: entry.allowancesTotal,
          allowanceItems: entry.allowanceItems,
          deductionsTotal: entry.deductionsTotal,
          deductionItems: entry.deductionItems,
          grossPay: entry.grossPay,
          netPay: entry.manualAdjustment ?? entry.netPay,
          manualAdjustment: entry.manualAdjustment,
          adjustmentNote: entry.adjustmentNote,
          status: entry.status,
        },
      },
    });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SIMULATION
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/** GET /api/payroll/simulate?userId=&year=&month= */
export const simulatePayroll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, year: y, month: m } = req.query as Record<string, string | undefined>;
    if (!userId) { res.status(400).json({ message: 'userId is required' }); return; }
    const now = nowGMT7();
    const year = parseInt(y ?? String(now.getFullYear()), 10);
    const month = parseInt(m ?? String(now.getMonth() + 1), 10);

    const employee = await User.findById(userId).select('fullName email').lean();
    if (!employee) { res.status(404).json({ message: 'Employee not found' }); return; }

    const profile = await getActiveProfile(new Types.ObjectId(userId), year, month);
    if (!profile) { res.json({ hasProfile: false, employee }); return; }

    const { standardHoursPerDay, scheduledCheckInTime } = await getWorkingConfig();
    const otPolicy = profile.overtimePolicyId ? await OvertimePolicy.findById(profile.overtimePolicyId) : null;
    const workSummary = await buildWorkSummary(new Types.ObjectId(userId), year, month, standardHoursPerDay, scheduledCheckInTime);
    const breakdown = computePayBreakdown(profile, otPolicy, workSummary, standardHoursPerDay);

    res.json({
      hasProfile: true,
      employee,
      profile: { payType: profile.payType, department: profile.department, jobTitle: profile.jobTitle, currency: profile.currency },
      workSummary,
      breakdown,
    });
  } catch (err) { res.status(500).json({ message: 'Server error', error: String(err) }); }
};


