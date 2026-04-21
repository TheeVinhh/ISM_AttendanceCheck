import { Request, Response } from 'express';
import { Attendance } from '../models/Attendance';
import { LeaveRequest } from '../models/LeaveRequest';
import { getWorkingHours } from '../models/WorkingHours';
import { nowGMT7, todayGMT7, getHourGMT7, getMinuteGMT7 } from '../utils/timezone';
import type { AttendanceStatus } from '../types';

// POST /api/attendance/checkin
export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const date = todayGMT7();

    const existing = await Attendance.findOne({ userId, date });
    if (existing?.checkInTime) {
      res.status(400).json({ message: 'Already checked in today' });
      return;
    }

    const now = new Date();          // UTC timestamp stored in DB
    const gmtNow = nowGMT7();        // GMT+7 shifted date for business logic
    const hour = getHourGMT7(gmtNow);
    const minute = getMinuteGMT7(gmtNow);

    // Late detection uses the configured WorkingHours (checkInTime + grace period)
    const wh = await getWorkingHours();
    const [threshH, threshM] = wh.checkInTime.split(':').map(Number);
    const scheduledMinutes = threshH * 60 + threshM + (wh.lateThresholdMinutes ?? 0);
    const currentMinutes = hour * 60 + minute;
    const status: AttendanceStatus = currentMinutes > scheduledMinutes ? 'late' : 'present';

    const record = existing
      ? await Attendance.findByIdAndUpdate(existing._id, { checkInTime: now, status }, { new: true })
      : await Attendance.create({ userId, date, checkInTime: now, status });

    res.json({ message: 'Checked in successfully', attendance: record });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// POST /api/attendance/checkout
export const checkOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const date = todayGMT7();

    const record = await Attendance.findOne({ userId, date });
    if (!record?.checkInTime) {
      res.status(400).json({ message: 'You have not checked in today' });
      return;
    }
    if (record.checkOutTime) {
      res.status(400).json({ message: 'Already checked out today' });
      return;
    }

    const updated = await Attendance.findByIdAndUpdate(
      record._id,
      { checkOutTime: new Date() },
      { new: true },
    );

    res.json({ message: 'Checked out successfully', attendance: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/attendance/today
export const getToday = async (req: Request, res: Response): Promise<void> => {
  try {
    const record = await Attendance.findOne({ userId: req.user!.id, date: todayGMT7() });
    res.json({ attendance: record ?? null });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/attendance/monthly?year=2026&month=4
export const getMonthly = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = nowGMT7();
    const year = parseInt(String(req.query['year'] ?? now.getFullYear()), 10);
    const month = parseInt(String(req.query['month'] ?? now.getMonth() + 1), 10);

    // Date strings for the requested month: YYYY-MM-01 to YYYY-MM-31
    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    const records = await Attendance.find({
      userId: req.user!.id,
      date: { $regex: `^${prefix}` },
    }).sort({ date: 1 });

    // Get all leaves for the month (all statuses for tracking)
    const leaves = await LeaveRequest.find({
      userId: req.user!.id,
      date: { $regex: `^${prefix}` },
    });

    res.json({ records, leaves });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/attendance/all  (admin)
export const getAllToday = async (req: Request, res: Response): Promise<void> => {
  try {
    const records = await Attendance.find({ date: todayGMT7() }).populate('userId', 'fullName email');
    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};
