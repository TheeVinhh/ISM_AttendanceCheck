import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.routes';
import attendanceRoutes from './routes/attendance.routes';
import leaveRoutes from './routes/leave.routes';
import adminRoutes from './routes/admin.routes';
import payrollRoutes from './routes/payroll.routes';

const app = express();
const PORT = process.env['PORT'] ?? 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env['FRONTEND_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payroll', payrollRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Database + Start ────────────────────────────────────────────────────────
mongoose
  .connect(process.env['MONGO_URI']!)
  .then(() => {
    console.log('✅  MongoDB connected');
    app.listen(PORT, () => console.log(`🚀  Server running on http://localhost:${PORT}`));
  })
  .catch((err: unknown) => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
