import { Request, Response } from 'express';
import { Attendance } from '../models/Attendance';
import { LeaveRequest } from '../models/LeaveRequest';
import { User } from '../models/User';
import { PayrollRun } from '../models/PayrollRun';
import { WorkingHours, getWorkingHours } from '../models/WorkingHours';
import { todayGMT7, nowGMT7 } from '../utils/timezone';

// GET /api/admin/metrics
export const getMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = todayGMT7();
    const now = nowGMT7();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Attendance counts
    const presentRecords = await Attendance.countDocuments({
      date: today,
      status: 'present',
    });

    const lateRecords = await Attendance.countDocuments({
      date: today,
      status: 'late',
    });

    const absentRecords = await Attendance.countDocuments({
      date: today,
      status: 'absent',
    });

    // Leave counts
    const pendingLeaves = await LeaveRequest.countDocuments({
      date: { $gte: today },
      status: 'pending',
    });

    const approvedLeavesToday = await LeaveRequest.countDocuments({
      date: today,
      status: 'approved',
    });

    // Total employees
    const totalEmployees = await User.countDocuments({ role: 'employee' });

    // Payroll run counts
    const draftPayruns = await PayrollRun.countDocuments({ status: 'draft' });
    const pendingPayruns = await PayrollRun.countDocuments({ status: 'under_review' });
    const approvedPayruns = await PayrollRun.countDocuments({ status: 'approved' });

    // Current month payroll status
    const currentRun = await PayrollRun.findOne({ year: currentYear, month: currentMonth });
    const currentMonthPayroll = currentRun
      ? `${currentYear}-${String(currentMonth).padStart(2, '0')} (${currentRun.status})`
      : `${currentYear}-${String(currentMonth).padStart(2, '0')} (not run)`;

    res.json({
      presentToday: presentRecords,
      lateToday: lateRecords,
      absentToday: absentRecords,
      pendingLeaves,
      approvedLeavesToday,
      totalEmployees,
      draftPayruns,
      pendingPayruns,
      approvedPayruns,
      currentMonthPayroll,
      date: today,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/admin/employees
export const listEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const today = todayGMT7();
    const employees = await User.find({ role: 'employee' }).select(
      'fullName email createdAt',
    );

    // Get today's attendance status for each employee
    const employeesWithStatus = await Promise.all(
      employees.map(async (emp) => {
        // Check for approved leave
        const leave = await LeaveRequest.findOne({ userId: emp._id, date: today, status: 'approved' });
        
        if (leave) {
          return {
            _id: emp._id,
            fullName: emp.fullName,
            email: emp.email,
            createdAt: emp.createdAt,
            todayStatus: 'out of office',
          };
        }

        const attendance = await Attendance.findOne({ userId: emp._id, date: today });
        let status = 'not checked in';
        if (attendance?.checkInTime) {
          status = attendance.status === 'late' ? 'late' : 'on time';
        }
        return {
          _id: emp._id,
          fullName: emp.fullName,
          email: emp.email,
          createdAt: emp.createdAt,
          todayStatus: status,
        };
      }),
    );

    res.json({ employees: employeesWithStatus });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/admin/attendance-report?year=2026&month=4
export const getAttendanceReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = nowGMT7();
    const year = parseInt(String(req.query['year'] ?? now.getFullYear()), 10);
    const month = parseInt(String(req.query['month'] ?? now.getMonth() + 1), 10);

    const prefix = `${year}-${String(month).padStart(2, '0')}`;

    // Get all attendance records for the month
    const records = await Attendance.find({
      date: { $regex: `^${prefix}` },
    })
      .populate('userId', 'fullName email')
      .sort({ date: -1, userId: 1 });

    // Group by employee
    const report: Record<string, unknown> = {};
    records.forEach((rec) => {
      const emp = (rec.userId as { _id: string; fullName: string; email: string } | null)?._id;
      if (emp) {
        if (!report[emp]) {
          report[emp] = [];
        }
        (report[emp] as unknown[]).push({
          date: rec.date,
          checkInTime: rec.checkInTime,
          checkOutTime: rec.checkOutTime,
          status: rec.status,
          notes: rec.notes,
        });
      }
    });

    res.json({ month, year, report, recordCount: records.length });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/admin/working-hours
export const getWorkingHoursConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await getWorkingHours();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// PUT /api/admin/working-hours
export const updateWorkingHours = async (req: Request, res: Response): Promise<void> => {
  try {
    const { checkInTime, checkOutTime, lateThresholdMinutes } = req.body as {
      checkInTime?: string;
      checkOutTime?: string;
      lateThresholdMinutes?: number;
    };

    let config = await WorkingHours.findOne();
    if (!config) {
      config = await WorkingHours.create({
        checkInTime: checkInTime ?? '09:00',
        checkOutTime: checkOutTime ?? '17:00',
        lateThresholdMinutes: lateThresholdMinutes ?? 0,
      });
    } else {
      if (checkInTime) config.checkInTime = checkInTime;
      if (checkOutTime) config.checkOutTime = checkOutTime;
      if (lateThresholdMinutes !== undefined) config.lateThresholdMinutes = lateThresholdMinutes;
      await config.save();
    }

    res.json({ message: 'Working hours updated', config });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// POST /api/admin/reset-attendance/:userId/:date
export const resetAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, date } = req.params as { userId?: string; date?: string };

    if (!userId || !date) {
      res.status(400).json({ message: 'userId and date are required' });
      return;
    }

    // Delete the attendance record
    const result = await Attendance.findOneAndDelete({ userId, date });
    if (!result) {
      res.status(404).json({ message: 'Attendance record not found' });
      return;
    }

    res.json({ message: 'Attendance record reset', deleted: result });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// PUT /api/admin/attendance/:attendanceId/status
export const updateAttendanceStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, notes } = req.body as { status?: string; notes?: string };
    const { attendanceId } = req.params as { attendanceId?: string };

    if (!attendanceId || !status) {
      res.status(400).json({ message: 'attendanceId and status are required' });
      return;
    }

    const valid = ['present', 'absent', 'late', 'half-day'];
    if (!valid.includes(status)) {
      res.status(400).json({ message: `status must be one of: ${valid.join(', ')}` });
      return;
    }

    const updated = await Attendance.findByIdAndUpdate(
      attendanceId,
      { status, notes: notes ?? '' },
      { new: true },
    );

    if (!updated) {
      res.status(404).json({ message: 'Attendance record not found' });
      return;
    }

    res.json({ message: 'Attendance status updated', attendance: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// GET /api/admin/employee/:userId/calendar?year=2026&month=4
export const getEmployeeCalendar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params as { userId?: string };
    if (!userId) {
      res.status(400).json({ message: 'userId is required' });
      return;
    }

    const employee = await User.findById(userId).select('fullName email');
    if (!employee) {
      res.status(404).json({ message: 'Employee not found' });
      return;
    }

    const now = nowGMT7();
    const year = parseInt(String(req.query['year'] ?? now.getFullYear()), 10);
    const month = parseInt(String(req.query['month'] ?? now.getMonth() + 1), 10);

    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const records = await Attendance.find({
      userId,
      date: { $regex: `^${prefix}` },
    }).sort({ date: 1 });

    // Get all leave requests for the month (all statuses)
    const leaves = await LeaveRequest.find({
      userId,
      date: { $regex: `^${prefix}` },
    }).sort({ date: 1 });

    res.json({
      employee: { _id: employee._id, fullName: employee.fullName, email: employee.email },
      month,
      year,
      records,
      leaves,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};

// POST /api/admin/attendance/:attendanceId/assign-ot
export const assignOT = async (req: Request, res: Response): Promise<void> => {
  const { attendanceId } = req.params;
  const { otAssignedCheckOutTime, remove } = req.body as {
    otAssignedCheckOutTime?: string;
    remove?: boolean;
  };

  try {
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      res.status(404).json({ message: 'Attendance record not found' });
      return;
    }

    if (remove) {
      // Remove OT assignment
      attendance.otAssignedByAdmin = false;
      attendance.otAssignedCheckOutTime = undefined;
      attendance.otAssignedBy = undefined;
    } else {
      // Validate checkout time format (HH:MM)
      if (!otAssignedCheckOutTime || !/^\d{2}:\d{2}$/.test(otAssignedCheckOutTime)) {
        res.status(400).json({ message: 'Invalid checkout time format. Use HH:MM' });
        return;
      }

      attendance.otAssignedByAdmin = true;
      attendance.otAssignedCheckOutTime = otAssignedCheckOutTime;
      attendance.otAssignedBy = (req as any).userId;
    }

    await attendance.save();
    res.json({ message: 'OT assignment updated', attendance });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: String(err) });
  }
};
