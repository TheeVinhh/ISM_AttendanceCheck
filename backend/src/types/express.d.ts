// Augment Express Request so req.user is available globally after auth middleware
import { JwtPayload } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
