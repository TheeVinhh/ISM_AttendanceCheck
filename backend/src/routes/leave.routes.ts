import { Router } from 'express';
import {
  submitLeave,
  getMyLeaves,
  getAllLeaves,
  updateLeaveStatus,
} from '../controllers/leave.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', submitLeave);
router.get('/my', getMyLeaves);
router.get('/', requireAdmin, getAllLeaves);
router.patch('/:id', requireAdmin, updateLeaveStatus);

export default router;
