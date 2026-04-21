import { Request, Response } from 'express';
import { LeaveRequest } from '../models/LeaveRequest';
import type { LeaveStatus, LeaveType, LeavePeriod } from '../types';

// POST /api/leaves  – employee submits
export const submitLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, leaveType, period, reason } = req.body as {
      date?: string;
      leaveType?: LeaveType;
      period?: LeavePeriod;
      reason?: string;
    };

    if (!date || !leaveType || !period || !reason) {
      res.status(400).json({
        message: 'date, leaveType, period, and reason are required',
      });
      return;
    }

    // Validate leaveType
    const validLeaveTypes: LeaveType[] = ['with_salary', 'without_salary'];
    if (!validLeaveTypes.includes(leaveType)) {
      res.status(400).json({
        message: 'leaveType must be "with_salary" or "without_salary"',
      });
      return;
    }

    // Validate period
    const validPeriods: LeavePeriod[] = ['full_day', 'half_day_morning', 'half_day_afternoon'];
    if (!validPeriods.includes(period)) {
      res.status(400).json({
        message: 'period must be "full_day", "half_day_morning", or "half_day_afternoon"',
      });
      return;
    }

    // Check for duplicates on same date/period combination
    const existing = await LeaveRequest.findOne({
      userId: req.user!.id,
      date,
      period,
    });
    if (existing) {
      res.status(409).json({
        message: 'Leave request already submitted for this date and period',
      });
      return;
    }

    // Calculate day count for balance validation
    const dayCount = period === 'full_day' ? 1 : 0.5;

    // Get approved leaves for this year
    const currentYear = new Date().getFullYear();
    const approvedLeaves = await LeaveRequest.find({
      userId: req.user!.id,
      leaveType,
      status: 'approved',
      date: {
        $gte: new Date(`${currentYear}-01-01`).toISOString(),
        $lte: new Date(`${currentYear}-12-31`).toISOString(),
      },
    });

    // Calculate used days
    const usedDays = approvedLeaves.reduce((sum, leave) => {
      const isDayCount = leave.period === 'full_day' ? 1 : 0.5;
      return sum + isDayCount;
    }, 0);

    // Validate balance
    const limit = leaveType === 'with_salary' ? 12 : 31;
    if (usedDays + dayCount > limit) {
      res.status(400).json({
        message: `Insufficient balance. You have ${limit - usedDays} days remaining.`,
      });
      return;
    }

    const leave = await LeaveRequest.create({
      userId: req.user!.id,
      date,
      leaveType,
      period,
      reason,
    });

    res.status(201).json({ message: 'Leave request submitted', leave });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/leaves/my  – employee sees own requests
export const getMyLeaves = async (req: Request, res: Response): Promise<void> => {
  try {
    const leaves = await LeaveRequest.find({ userId: req.user!.id }).sort({ date: -1 });
    res.json({ leaves });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/leaves  – admin sees all
export const getAllLeaves = async (req: Request, res: Response): Promise<void> => {
  try {
    const leaves = await LeaveRequest.find()
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 });
    res.json({ leaves });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// PATCH /api/leaves/:id  – admin approves or rejects
export const updateLeaveStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body as { status?: string };
    const allowed: LeaveStatus[] = ['approved', 'rejected'];

    if (!status || !allowed.includes(status as LeaveStatus)) {
      res.status(400).json({ message: 'status must be "approved" or "rejected"' });
      return;
    }

    const leave = await LeaveRequest.findByIdAndUpdate(
      req.params['id'],
      { status, reviewedBy: req.user!.id },
      { new: true },
    );

    if (!leave) {
      res.status(404).json({ message: 'Leave request not found' });
      return;
    }

    res.json({ message: `Leave ${status}`, leave });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};
