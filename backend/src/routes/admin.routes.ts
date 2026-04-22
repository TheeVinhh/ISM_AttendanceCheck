import { Router } from 'express';
import {
  getMetrics,
  listEmployees,
  getAttendanceReport,
  getWorkingHoursConfig,
  updateWorkingHours,
  resetAttendance,
  updateAttendanceStatus,
  getEmployeeCalendar,
  assignOT,
} from '../controllers/admin.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// All routes require auth + admin
router.use(authenticate, requireAdmin);

router.get('/metrics', getMetrics);
router.get('/employees', listEmployees);
router.get('/attendance-report', getAttendanceReport);
router.get('/employee/:userId/calendar', getEmployeeCalendar);

router.get('/working-hours', getWorkingHoursConfig);
router.put('/working-hours', updateWorkingHours);

router.post('/reset-attendance/:userId/:date', resetAttendance);
router.put('/attendance/:attendanceId/status', updateAttendanceStatus);
router.post('/attendance/:attendanceId/assign-ot', assignOT);

export default router;
