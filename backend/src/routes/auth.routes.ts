import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { azureLogin } from '../controllers/azure.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/azure', azureLogin);   // Microsoft SSO — receives MSAL idToken
router.get('/me', authenticate, getMe);

export default router;
