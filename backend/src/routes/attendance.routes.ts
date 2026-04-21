import { Router } from 'express';
import {
  checkIn,
  checkOut,
  getToday,
  getMonthly,
  getAllToday,
} from '../controllers/attendance.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/checkin', checkIn);
router.post('/checkout', checkOut);
router.get('/today', getToday);
router.get('/monthly', getMonthly);
router.get('/all', requireAdmin, getAllToday);

export default router;
