import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { PayrollRun } from '../models/PayrollRun';

/**
 * Role-Based Access Control Middleware
 * Enforces admin-only and employee self-service access patterns
 */

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
};

export const requireAdminOrSelf = (req: Request, res: Response, next: NextFunction): void => {
  const targetUserId = req.params.userId;

  if (req.user?.role === 'admin') {
    next();
    return;
  }

  if (req.user?.id === targetUserId || req.user?._id?.toString() === targetUserId) {
    next();
    return;
  }

  res.status(403).json({ message: 'You can only access your own data' });
};

/**
 * Check if a payroll run is in draft status (and thus editable)
 * Admins can edit draft runs; employees cannot edit any runs
 */
export const requireDraftStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { runId } = req.params;

  try {
    const run = await PayrollRun.findById(runId).lean();
    if (!run) {
      res.status(404).json({ message: 'Payroll run not found' });
      return;
    }

    if (run.status !== 'draft') {
      res.status(409).json({
        message: `Payroll run is in "${run.status}" status and cannot be edited`,
        currentStatus: run.status,
      });
      return;
    }

    // Attach run to request for downstream handlers
    (req as any).payrollRun = run;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking payroll run status' });
  }
};

/**
 * Ensure user has access to view a payroll run
 * Admins can view all; employees can view only if they have an entry in the run
 */
export const canViewRun = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { runId } = req.params;
  const userId = req.user?.id || req.user?._id?.toString();

  try {
    const run = await PayrollRun.findById(runId).lean();
    if (!run) {
      res.status(404).json({ message: 'Payroll run not found' });
      return;
    }

    if (req.user?.role === 'admin') {
      // Admins can view all runs
      (req as any).payrollRun = run;
      next();
      return;
    }

    // Employees can only view if they have an entry in the run
    const hasEntry = run.entries.some(
      (entry) => entry.userId.toString() === userId,
    );

    if (!hasEntry) {
      res.status(403).json({ message: 'You do not have access to this payroll run' });
      return;
    }

    (req as any).payrollRun = run;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error verifying access to payroll run' });
  }
};

/**
 * Ensure user can only view/edit their own entry in a payroll run
 * Only used for employee self-service endpoints
 */
export const canAccessOwnEntry = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const { runId } = req.params;
  const userId = req.user?.id || req.user?._id?.toString();

  try {
    const run = await PayrollRun.findById(runId).lean();
    if (!run) {
      res.status(404).json({ message: 'Payroll run not found' });
      return;
    }

    const entry = run.entries.find(
      (e) => e.userId.toString() === userId,
    );

    if (!entry) {
      res.status(403).json({ message: 'You do not have an entry in this payroll run' });
      return;
    }

    (req as any).payrollRun = run;
    (req as any).payrollEntry = entry;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error verifying access to payroll entry' });
  }
};
