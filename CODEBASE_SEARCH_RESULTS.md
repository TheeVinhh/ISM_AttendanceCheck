# Codebase Search Results - Comprehensive Findings

## 1. EMPLOYER CONTRIBUTIONS

### Overview
Employer contributions are tracked for HR records (informational only, not deducted from employee net pay). They represent the employer's financial obligations for social insurance.

### Backend - Models
**File:** [backend/src/models/PayrollRun.ts](backend/src/models/PayrollRun.ts)

- **Lines 56-60:** Employer contributions interface definition
  ```typescript
  // Employer contributions (informational, not deducted from net)
  bhxhEmployer: number;          // 17.5%
  bhytEmployer: number;          // 3%
  bhtnEmployer: number;          // 1%
  totalInsuranceEmployer: number;
  ```

- **Lines 139-142:** Mongoose schema for employer contributions
  ```typescript
  bhxhEmployer: { type: Number, default: 0 },
  bhytEmployer: { type: Number, default: 0 },
  bhtnEmployer: { type: Number, default: 0 },
  totalInsuranceEmployer: { type: Number, default: 0 },
  ```

### Backend - Controller Calculations
**File:** [backend/src/controllers/payroll.controller.ts](backend/src/controllers/payroll.controller.ts)

- **Lines 70:** Employer insurance rates constants
  ```typescript
  // Employer insurance rates (informational)
  const BHXH_ER = 0.175;
  const BHYT_ER = 0.03;
  const BHTN_ER = 0.01;
  ```

- **Lines 285-289:** Employer contribution calculations in payroll calculation function
  ```typescript
  // Employer contributions (for HR record only, not deducted from employee net)
  const bhxhEmployer           = Math.round(insurableSalary * BHXH_ER);     // 17.5%
  const bhytEmployer           = Math.round(insurableSalary * BHYT_ER);     // 3%
  const bhtnEmployer           = Math.round(insurableSalary * BHTN_ER);     // 1%
  const totalInsuranceEmployer = bhxhEmployer + bhytEmployer + bhtnEmployer;
  ```

- **Line 312:** Returns employer contributions in payroll calculation result

- **Line 553:** Default values for employer contributions when creating entries

### Frontend - Types
**File:** [frontend/src/types/index.ts](frontend/src/types/index.ts)

- **Lines 141-144:** TypeScript interfaces for employer contributions
  ```typescript
  bhxhEmployer: number;
  bhytEmployer: number;
  bhtnEmployer: number;
  totalInsuranceEmployer: number;
  ```

### Frontend - Display Component
**File:** [frontend/src/pages/PayrollPage.tsx](frontend/src/pages/PayrollPage.tsx)

- **Lines 1147-1155:** Employer contributions display section in payroll detail view
  ```typescript
  {/* Employer contributions reference */}
  <details className="text-xs text-gray-400">
    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Employer contributions (for reference)</summary>
    <div className="mt-2 space-y-1 pl-2">
      <div className="flex justify-between"><span>BHXH 17.5%</span><span>{fmt(entry.bhxhEmployer)} {entry.currency}</span></div>
      <div className="flex justify-between"><span>BHYT 3%</span><span>{fmt(entry.bhytEmployer)} {entry.currency}</span></div>
      <div className="flex justify-between"><span>BHTN 1%</span><span>{fmt(entry.bhtnEmployer)} {entry.currency}</span></div>
      <div className="flex justify-between font-semibold"><span>Total employer cost</span><span>{fmt(entry.totalInsuranceEmployer + entry.grossPay)} {entry.currency}</span></div>
    </div>
  </details>
  ```

---

## 2. PAYROLL DISPLAY COMPONENT STRUCTURE

### Frontend - PayrollPage Component
**File:** [frontend/src/pages/PayrollPage.tsx](frontend/src/pages/PayrollPage.tsx)

#### Main Sections:

1. **Profile Edit Modal (Lines 100-260)**
   - Pay Type selection (hourly, salaried, contract)
   - Department, Job Title, Grade fields
   - Currency selection
   - OT Policy assignment
   - Effective From date
   - Allowances and Deductions item editor
   - Notes field

2. **Employees Tab (Lines 280-380)**
   - Department and Pay Type filters
   - Employee list table showing:
     - Employee name/email
     - Department
     - Pay Type badge
     - Job Title/Grade
     - Base Pay
     - OT Policy
     - Effective From date
   - Edit/Setup action buttons

3. **Runs Tab (Lines 420-1170)**

   a. **Calculate Control (Lines 520-535)** - Admin only
      - Month/Year selectors
      - "Calculate Run" button

   b. **Payroll Runs List Table (Lines 560-610)**
      - Period (Month/Year)
      - Status badge (Draft, Under Review, Approved, Exported)
      - Employee count
      - Total Gross Pay
      - Total Deductions
      - Total Net Pay
      - Created date
      - View/Manage button

   c. **Detail Modal (Lines 645-1170)**
      - Summary cards with totals
      - Status + Workflow actions (Recalculate, Submit, Approve, Export)
      
      - **Employee Breakdown Table (Lines 900-1030)**
        Columns include:
        - Employee (name/email) - admin only
        - Department
        - Pay Type
        - Work Days / Present / Late / Absent / Leave
        - Regular Hours / OT Hours
        - Base Pay / OT Pay
        - Allowances / Deductions / Gross Pay / Net Pay
        - Final Pay (with manual adjustment indicator)
        - Entry Status
        - Actions (Adjust) - admin only, draft status

      - **Entry Detail Expandable Section (Lines 1045-1170)**
        Shows for each entry:
        - Work Summary (working days, present, late, absent, leave, hours)
        - Base Pay Calculation
        - Overtime Pay Calculation
        - Allowances breakdown
        - Insurance salary calculation with ceiling note
        - Employee Insurance Contributions (Orange section)
          * BHXH 8%
          * BHYT 1.5%
          * BHTN 1%
          * Total Insurance (10.5%)
        - Personal Income Tax section (Blue section)
          * Personal Relief
          * Dependent Relief (if applicable)
          * Taxable Income
          * PIT Amount
        - **Employer Contributions Reference (Collapsible)**
          * BHXH 17.5%
          * BHYT 3%
          * BHTN 1%
          * Total employer cost (contributions + gross)
        - Other Deductions itemization
        - Net Pay Summary (green section)
          * Shows calculation formula
          * Displays manual adjustment if applied

4. **OT Policies Tab (Lines 1170+)**
   - Create/Edit OT Policy form
   - Daily OT threshold and rate
   - Weekly OT threshold and rate
   - Weekend rate multiplier
   - Holiday rate multiplier
   - Max OT hours per month cap
   - Policy list display

---

## 3. OVERTIME (OT) RELATED CODE

### Backend - Overtime Policy Model
**File:** [backend/src/models/OvertimePolicy.ts](backend/src/models/OvertimePolicy.ts)

- **Lines 1-52:** Complete overtime policy definition
  ```typescript
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
  ```

### Backend - Controller OT References
**File:** [backend/src/controllers/payroll.controller.ts](backend/src/controllers/payroll.controller.ts)

- **Line 120-121:** Scheduled check-in time usage for calculating OT from early arrivals
  ```typescript
  /** Scheduled check-in time as "HH:mm" (GMT+7), used to clamp early arrivals */
  scheduledCheckInTime: string;
  ```

- **Lines 186-191:** Early arrival clamping logic (prevents earning OT before shift starts)
  ```typescript
  // Clamp effective check-in to the scheduled start time.
  // An employee who arrives early does not earn pay before the shift starts.
  // rec.date is "YYYY-MM-DD" in GMT+7. Scheduled check-in in UTC = schH - 7h on that date.
  const [schH, schM] = scheduledCheckInTime.split(':').map(Number);
  const scheduledCheckInMs = Date.UTC(yr, mo - 1, dy, schH - 7, schM, 0, 0);
  const effectiveCheckIn = new Date(Math.max(rec.checkInTime.getTime(), scheduledCheckInMs));
  ```

- **Lines 561, 783:** Work summary building with OT hour calculations

### Frontend - OT Policy Management
**File:** [frontend/src/pages/PayrollPage.tsx](frontend/src/pages/PayrollPage.tsx)

- **Lines 1170-1310:** OTPoliciesTab component
  - Create new policy button
  - Policy cards display with:
    - Policy name and description
    - Daily threshold and rate
    - Weekly threshold and rate
    - Weekend and Holiday rates
  - Edit/Delete actions
  - Policy form with all configurable fields

### Test Scenarios Documentation
**File:** [TEST_SCENARIOS.md](TEST_SCENARIOS.md)

- **Line 148:** Scenario 6: Overtime Pay Calculated Correctly (Weekday 150%, Weekend 200%)
  ```
  OT Policy: dailyOTRate = 1.5 (150% weekday), weekendRate = 2.0 (200%)
  ```
- **Lines 17, 22-25, 30:** Detailed OT calculation examples showing:
  - Early check-in does not count (clamped)
  - Regular hours = 8.5, Overtime hours = 0.5
  - Base pay calculated on regular + OT hours

---

## 4. CALENDAR IMPLEMENTATION FOR SCHEDULING

### Frontend - Calendar Component
**File:** [frontend/src/pages/CalendarPage.tsx](frontend/src/pages/CalendarPage.tsx)

#### Overview Structure (Lines 1-250):

1. **Data Structures**
   - `MonthlyData`: Contains `records: AttendanceRecord[]` and `leaves: LeaveRequest[]`
   - `CellType`: Types include 'present', 'late', 'absent-checkout', 'approved-leave', 'pending-leave', 'rejected-leave', 'weekend', 'future', 'empty'
   - `DayInfo`: Contains day number, date string, type, check-in/out times, leave label

2. **Cell Styling Map (Lines 27-35)**
   ```typescript
   const cellStyle: Record<CellType, string> = {
     present: 'bg-green-500 text-white',
     late: 'bg-yellow-400 text-gray-900',
     'absent-checkout': 'bg-red-500 text-white',
     'approved-leave': 'bg-green-300 text-green-900',
     'pending-leave': 'bg-blue-300 text-blue-900',
     'rejected-leave': 'bg-red-200 text-red-900',
     weekend: 'bg-transparent text-gray-400',
     future: 'bg-gray-100 text-gray-400',
     empty: 'bg-transparent',
   };
   ```

3. **Calendar Component Features (Lines 40-250)**
   - Month/Year navigation (prev/next buttons)
   - Date fetching via API call to `/attendance/monthly`
   - Legend showing color codes for each status
   - Grid layout (7 columns for days of week)
   - Cell display showing:
     - Day number (bold)
     - Check-in time (if present)
     - Check-out time (if present)
     - Leave label (with status icon: ✓ approved, ⏳ pending, ✗ rejected)

4. **Classification Logic (Lines 80-110)**
   - Weekends (Sun/Sat) show as gray "weekend"
   - Future dates show as gray "future" (except approved/pending leaves)
   - No attendance record = "absent-checkout" (red)
   - Has check-out = "present" or "late" based on status
   - No check-out = "present" or "late" based on status
   - Approved leave takes priority display (can show with check-in/out times)
   - Pending/Rejected leave shown when no attendance record

### Backend - Calendar API Endpoint
**File:** [backend/src/controllers/admin.controller.ts](backend/src/controllers/admin.controller.ts)

- **Lines 244-280:** `getEmployeeCalendar` endpoint
  ```typescript
  // GET /api/admin/employee/:userId/calendar?year=2026&month=4
  export const getEmployeeCalendar = async (req: Request, res: Response): Promise<void> => {
    // Retrieves:
    // 1. Employee details (fullName, email)
    // 2. Attendance records for the month (date-filtered)
    // 3. Leave requests for the month (all statuses)
    // Returns sorted by date
  }
  ```

### Backend - Routes
**File:** [backend/src/routes/admin.routes.ts](backend/src/routes/admin.routes.ts)

- **Line 22:** Route definition
  ```typescript
  router.get('/employee/:userId/calendar', getEmployeeCalendar);
  ```

### Frontend - Router Configuration
**File:** [frontend/src/App.tsx](frontend/src/App.tsx)

- **Line 6:** Import CalendarPage component
- **Line 51:** Route registration
  ```typescript
  <Route path="/calendar" element={<CalendarPage />} />
  ```

---

## Summary Statistics

| Category | Files | Key Lines |
|----------|-------|-----------|
| Employer Contributions | 5 files | 56-60 (model), 70-89 (constants), 285-289 (calculation), 1147-1155 (display) |
| Payroll Display | 1 file | Lines 100-1310 in PayrollPage.tsx (11 distinct sections) |
| Overtime Policy | 2 files | 1-52 (OvertimePolicy.ts), 1170-1310 (PayrollPage.tsx management) |
| Calendar Implementation | 3 files | 1-250 (CalendarPage.tsx), 244-280 (admin.controller.ts), 22 (routes) |

---

## Vietnam Payroll Constants Reference
**File:** [backend/src/controllers/payroll.controller.ts](backend/src/controllers/payroll.controller.ts)

- **VN_BASE_SALARY:** 2,340,000 VND
- **VN_INSURANCE_CEILING:** 46,800,000 VND (20 × base salary)
- **VN_PERSONAL_RELIEF:** 11,000,000 VND/month
- **VN_DEPENDENT_RELIEF:** 4,400,000 VND/dependent/month
- **PIT Progressive Brackets:** 5% → 35% with 7 tiers
