import { Router } from 'express';
import {
  // Departments
  listDepartments, upsertDepartment, deleteDepartment,
  // OT Policies
  listOTPolicies, upsertOTPolicy, deleteOTPolicy,
  // Employee Pay Profiles
  listProfiles, getUserProfileHistory, createProfile,
  // Payroll Runs
  listPayrollRuns, createPayrollRun, getPayrollRun,
  submitRun, approveRun, adjustEntry, exportRunCSV,
  // Employee Payslip
  getMyPayslip,
  // Simulation
  simulatePayroll,
} from '../controllers/payroll.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate); // All payroll endpoints require authentication

// ── Admin-only: Departments ────────────────────────────────────────────────
router.get('/departments', requireAdmin, listDepartments);
router.post('/departments', requireAdmin, upsertDepartment);
router.put('/departments/:id', requireAdmin, upsertDepartment);
router.delete('/departments/:id', requireAdmin, deleteDepartment);

// ── Admin-only: OT Policies ─────────────────────────────────────────────────
router.get('/ot-policies', requireAdmin, listOTPolicies);
router.post('/ot-policies', requireAdmin, upsertOTPolicy);
router.put('/ot-policies/:id', requireAdmin, upsertOTPolicy);
router.delete('/ot-policies/:id', requireAdmin, deleteOTPolicy);

// ── Admin-only: Employee Pay Profiles (versioned) ──────────────────────────
router.get('/profiles', requireAdmin, listProfiles);
router.get('/profiles/:userId/history', requireAdmin, getUserProfileHistory);
router.post('/profiles/:userId', requireAdmin, createProfile);

// ── Payroll Runs: Admin can manage; employees can view their own ────────────
router.get('/runs', listPayrollRuns); // Role-based filtering inside handler
router.post('/runs', requireAdmin, createPayrollRun);
router.get('/runs/:runId', getPayrollRun); // Role-based filtering inside handler
router.post('/runs/:runId/submit', requireAdmin, submitRun);
router.post('/runs/:runId/approve', requireAdmin, approveRun);
router.put('/runs/:runId/entries/:userId', requireAdmin, adjustEntry);
router.get('/runs/:runId/export-csv', requireAdmin, exportRunCSV);

// ── Employee Self-Service: View own payslip ────────────────────────────────
router.get('/runs/:runId/my-payslip', getMyPayslip);

// ── Simulation (Admin only) ────────────────────────────────────────────────
router.get('/simulate', requireAdmin, simulatePayroll);

export default router;

