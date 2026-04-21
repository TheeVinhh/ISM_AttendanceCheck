# Enterprise Payroll System - Test Scenarios

## Setup
- **System Date**: April 21, 2026 (GMT+7)
- **Test User**: NGUYEN THE VINH (Employee)
- **Admin User**: Admin Account
- **Test Month**: April 2026 (20 working days)
- **Base Config**: Check-in 09:00, Check-out 17:00, Grace period 0 min

---

## Scenario 1: Early Check-in Does Not Count in Payroll
**Objective**: Verify early arrivals are clamped to scheduled start time (BUG FIX #3)

**Steps**:
1. Employee checks in at **08:30 GMT+7** (30 minutes early)
2. Employee checks out at **17:30 GMT+7** (30 min OT)
3. Admin runs payroll for April 2026
4. Inspect the employee's payroll entry

**Expected Result**:
- ✅ Regular hours = **8.5 hours** (09:00–17:30 clamped, not 09:00 actual check-in time)
- ✅ Overtime hours = **0.5 hours** (only 17:00–17:30)
- ✅ No phantom 30 minutes added from early arrival
- ✅ Base pay calculated on **8.5 regular + 0.5 OT**, not **9 hours**

**Database Check**:
```
PayrollRunEntry.regularHours = 8.5
PayrollRunEntry.overtimeHours = 0.5
```

---

## Scenario 2: Late Check-in Marked Correctly Using WorkingHours Config
**Objective**: Verify late detection respects `WorkingHours` config (BUG FIX #1 & #2)

**Steps**:
1. Admin sets **WorkingHours**: checkInTime = "09:30", lateThresholdMinutes = 5
2. Employee A checks in at **09:33** → should be marked LATE
3. Employee B checks in at **09:34** → should be marked LATE
4. Employee C checks in at **09:35** → should be marked PRESENT (at threshold)
5. Check attendance records

**Expected Result**:
- ✅ Employee A: status = `late` (33 min > 30 min + 5 min grace)
- ✅ Employee B: status = `late` (34 min > 35 min threshold)
- ✅ Employee C: status = `present` (35 min = exactly at threshold)
- ✅ Timezone is correctly handled (nowGMT7 not UTC)

---

## Scenario 3: Approved Payroll Cannot Be Adjusted
**Objective**: Verify adjustEntry blocks approved runs (BUG FIX #4)

**Steps**:
1. Admin creates payroll for April 2026 → status = `draft`
2. Admin submits for review → status = `under_review`
3. Admin approves → status = `approved` (entries locked)
4. Admin attempts to adjust Employee A's net pay from 15M to 16M VND
5. Check API response

**Expected Result**:
- ✅ HTTP 409: "Cannot adjust a 'approved' payroll run. Only draft or under-review runs may be adjusted."
- ✅ Employee A's net pay remains **15M VND** (unchanged)
- ✅ Only `draft` and `under_review` allow adjustments

**Positive Test** (adjustment allowed):
- Submit run back to draft → adjust succeeds
- Re-approve → locks again

---

## Scenario 4: Employee Cannot View Other Employees' Salary History
**Objective**: Verify RBAC on profile history endpoint (BUG FIX #5)

**Setup**:
- Employee 1: NGUYEN THE VINH
- Employee 2: TRAN VAN B
- Both logged in via separate browser sessions

**Steps**:
1. Employee 1 logs in
2. Attempts: `GET /payroll/profiles/{Employee2_ID}/history`
3. Also attempts: `GET /payroll/profiles/{Employee1_ID}/history` (own ID)
4. Admin logs in
5. Admin attempts: `GET /payroll/profiles/{Employee2_ID}/history`

**Expected Result**:
- ✅ Employee 1 → Employee 2's history: HTTP 403 "Access denied"
- ✅ Employee 1 → own history: HTTP 200 with full profile array
- ✅ Admin → any employee's history: HTTP 200 (full access)

---

## Scenario 5: Vietnam Statutory Deductions Correctly Calculated
**Objective**: Verify Vietnam PIT, insurance, and reliefs (enterprise compliance)

**Employee Profile**:
- Monthly salary: **30,000,000 VND**
- Pay type: Salaried
- Working days: 20
- Present days: 20 (no absences/lates)
- Regular hours: 160 (8 hrs/day × 20 days)
- Number of dependents: **2**

**Expected Calculation**:
```
Gross Pay = 30,000,000

Insurance Calculation:
  Insurable Salary = min(30M, 46.8M) = 30M
  BHXH Employee (8%) = 2,400,000
  BHYT Employee (1.5%) = 450,000
  BHTN Employee (1%) = 300,000
  Total Employee Insurance = 3,150,000

PIT Calculation:
  Taxable = Gross - Insurance - Personal Relief - Dependent Relief - Non-taxable Allowances
  Personal Relief = 11,000,000
  Dependent Relief = 2 × 4,400,000 = 8,800,000
  Taxable Income = 30,000,000 - 3,150,000 - 11,000,000 - 8,800,000 = 7,050,000

  PIT (progressive):
    First 5M @ 5% = 250,000
    Next 2.05M @ 10% = 205,000
    Total PIT = 455,000

Net Pay = 30,000,000 - 3,150,000 - 455,000 = 26,395,000
```

**Steps**:
1. Create employee profile with above data
2. Run payroll for April 2026
3. Inspect PayrollRunEntry

**Expected Result**:
- ✅ `entry.insurableSalary = 30,000,000`
- ✅ `entry.totalInsuranceEmployee = 3,150,000`
- ✅ `entry.personalRelief = 11,000,000`
- ✅ `entry.dependentRelief = 8,800,000`
- ✅ `entry.taxableIncome = 7,050,000`
- ✅ `entry.pitAmount = 455,000`
- ✅ `entry.netPay = 26,395,000`

---

## Scenario 6: Overtime Pay Calculated Correctly (Weekday 150%, Weekend 200%)
**Objective**: Verify OT rates for different day types

**Employee Profile**:
- Hourly rate: **100,000 VND/hour**
- OT Policy: dailyOTRate = 1.5 (150% weekday), weekendRate = 2.0 (200%)

**Attendance**:
- Monday–Friday (5 weekdays): 8 regular + 2 OT hours each = 50 regular + 10 OT
- Saturday (1 weekend): 4 hours
- Total: 50 regular + 10 weekday OT + 4 weekend hours

**Steps**:
1. Create above attendance records
2. Run payroll
3. Inspect `entry.basePay` and `entry.overtimePay`

**Expected Result**:
```
Base Pay = 50 hours × 100,000 = 5,000,000
OT Pay = (10 hours × 100,000 × 1.5) + (4 hours × 100,000 × 2.0)
       = 1,500,000 + 800,000
       = 2,300,000
```
- ✅ `entry.basePay = 5,000,000`
- ✅ `entry.overtimePay = 2,300,000`
- ✅ `entry.regularHours = 50`
- ✅ `entry.overtimeHours = 10`
- ✅ `entry.weekendHours = 4`

---

## Scenario 7: Payroll Run Input Validation (Year/Month/PayType)
**Objective**: Verify input sanitization rejects invalid data (BUG FIX #6 & #7)

**Tests**:

**Test 7a — Invalid Month**:
- `POST /payroll/runs` with `month: 13`
- Expected: HTTP 400 "Invalid month. Must be between 1 and 12."

**Test 7b — Invalid Year**:
- `POST /payroll/runs` with `year: 1990`
- Expected: HTTP 400 "Invalid year. Must be between 2000 and 2100."

**Test 7c — Invalid PayType**:
- `POST /payroll/profiles/:userId` with `payType: "freelance"`
- Expected: HTTP 400 "payType must be one of: hourly, salaried, contract"

**Expected Result**:
- ✅ All three validations reject invalid input
- ✅ No garbage data inserted into MongoDB
- ✅ Error messages are clear

---

## Scenario 8: Employee Cannot Access Payroll Before Submission
**Objective**: Verify role-based access — employees only see submitted/approved runs

**Setup**:
- Payroll for April 2026 created → status = `draft`
- Employee has entry in this run

**Steps**:
1. Employee logs in
2. Employee calls: `GET /payroll/runs`
3. Employee calls: `GET /payroll/runs/{runId}`
4. Admin submits run → status = `under_review`
5. Employee calls `GET /payroll/runs` again

**Expected Result**:
- ✅ While draft: `GET /payroll/runs` returns empty array (no visible runs)
- ✅ `GET /payroll/runs/{runId}` returns HTTP 403 (no entry visible in draft)
- ✅ After submit: runs appear in employee's list
- ✅ After approval: employee can view their payslip

---

## Scenario 9: Salaried Employee Proration by Presence
**Objective**: Verify base pay proration for absences/leaves

**Employee Profile**:
- Monthly salary: **20,000,000 VND**
- Pay type: Salaried
- Working days: 20
- Present days: **18** (2 absences)
- Leave days: **0**

**Steps**:
1. Create profile with above
2. Create attendance records (18 present, 2 absent)
3. Run payroll

**Expected Result**:
```
Paid Days = 18 + 0 + 0 = 18 (present + leaveDays + lateDays)
Base Pay = 20,000,000 × (18 / 20) = 18,000,000
```
- ✅ `entry.basePay = 18,000,000` (prorated for 2 absences)
- ✅ `entry.workingDays = 20`
- ✅ `entry.presentDays = 18`
- ✅ `entry.absentDays = 2`

---

## Scenario 10: Admin Manual Adjustment Before Approval
**Objective**: Verify manual payroll adjustments with audit trail

**Setup**:
- Payroll draft: Employee X net pay = **10,000,000 VND**
- Admin decides to bonus +500,000 due to extra performance

**Steps**:
1. Admin calls: `PUT /payroll/runs/{runId}/entries/{userId}`
   ```json
   {
     "manualAdjustment": 10500000,
     "adjustmentNote": "Performance bonus - Q1 target exceeded"
   }
   ```
2. Check entry response
3. Admin exports CSV
4. Inspect the CSV export

**Expected Result**:
- ✅ `entry.manualAdjustment = 10,500,000`
- ✅ `entry.adjustmentNote = "Performance bonus - Q1 target exceeded"`
- ✅ `entry.status = "adjusted"`
- ✅ CSV shows both "Net Pay" (10,000,000) and "Final Pay" (10,500,000) columns
- ✅ Audit trail is preserved in database

---

## Running These Tests

### Manual Testing (UI + API):
```bash
# Terminal 1: Start backend
cd backend
npm run dev

# Terminal 2: Start frontend
cd frontend
npm run dev

# Terminal 3: Test API directly
curl -X POST http://localhost:3000/api/payroll/runs \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{"year": 2026, "month": 4}'
```

### Automated Testing (Jest):
```bash
# Create test file
touch backend/src/__tests__/payroll.test.ts

# Run tests
npm test -- payroll.test.ts
```

### Test Database Reset:
```bash
# Before each scenario, reset MongoDB
mongo
use attendance_system
db.attendances.deleteMany({})
db.payrollruns.deleteMany({})
db.employeePayProfiles.deleteMany({})
```

---

## Pass/Fail Criteria

| Scenario | Must Pass | Notes |
|----------|-----------|-------|
| 1 | Regular hours = 8.5 | Early check-in clamped |
| 2 | Late detection accurate | Respects WorkingHours config |
| 3 | HTTP 409 on approved adjust | Immutability enforced |
| 4 | Employee gets 403 access denied | RBAC working |
| 5 | Net pay = 26,395,000 VND | PIT + insurance correct |
| 6 | OT pay = 2,300,000 VND | Rate multipliers correct |
| 7 | All validations reject | No injection possible |
| 8 | Empty list while draft | Role-based visibility |
| 9 | Base pay = 18,000,000 VND | Proration by presence |
| 10 | CSV shows final pay | Audit trail intact |

---

## Enterprise Compliance Checklist

- [x] Vietnam PIT (5–35% progressive brackets)
- [x] Insurance deductions (BHXH 8%, BHYT 1.5%, BHTN 1%)
- [x] Personal relief (11M VND)
- [x] Dependent relief (4.4M VND per dependent)
- [x] Timezone consistency (GMT+7 only)
- [x] Role-based access control (no salary leaks)
- [x] Immutable approved payroll
- [x] Audit trails (adjustment notes)
- [x] Input validation (no garbage data)
- [x] Early-arrival clamping (no phantom hours)
