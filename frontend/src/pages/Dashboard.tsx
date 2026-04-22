import { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';
import { formatTimeGMT7, getDateLabelGMT7, getTodayGMT7 } from '../utils/timezone';
import type { AttendanceRecord, LeaveRequest } from '../types';

interface WorkingHours {
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
}

export default function Dashboard() {
  const { user } = useAuth();

  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loadingAttend, setLoadingAttend] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [todayLeave, setTodayLeave] = useState<LeaveRequest | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);

  const fetchToday = async () => {
    try {
      const { data } = await api.get<{ attendance: AttendanceRecord | null }>('/attendance/today');
      setAttendance(data.attendance);
    } finally {
      setLoadingAttend(false);
    }
  };

  useEffect(() => {
    void fetchToday();
    // Fetch today's leave request
    const fetchTodayLeave = async () => {
      try {
        const todayStr = getTodayGMT7();
        const { data } = await api.get<{ leaves: LeaveRequest[] }>('/leaves/my');
        const today = data.leaves.find((l) => l.date === todayStr && l.status === 'approved');
        setTodayLeave(today ?? null);
      } catch {
        setTodayLeave(null);
      }
    };
    void fetchTodayLeave();
    // Fetch working hours
    const fetchWorkingHours = async () => {
      try {
        const { data } = await api.get<{ config: WorkingHours }>('/attendance/working-hours');
        setWorkingHours(data.config);
      } catch {
        setWorkingHours(null);
      }
    };
    void fetchWorkingHours();
  }, []);

  const handleCheckIn = async () => {
    setActionMsg('');
    setActionError('');
    setActionLoading(true);
    try {
      const { data } = await api.post<{ message: string; attendance: AttendanceRecord }>(
        '/attendance/checkin',
      );
      setActionMsg(data.message);
      setAttendance(data.attendance);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setActionError(
          (err.response?.data as { message?: string })?.message ?? 'Check-in failed',
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionMsg('');
    setActionError('');
    setActionLoading(true);
    try {
      const { data } = await api.post<{ message: string; attendance: AttendanceRecord }>(
        '/attendance/checkout',
      );
      setActionMsg(data.message);
      setAttendance(data.attendance);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setActionError(
          (err.response?.data as { message?: string })?.message ?? 'Check-out failed',
        );
      }
    } finally {
      setActionLoading(false);
    }
  };

  const fmt = (iso: string | null) =>
    formatTimeGMT7(iso);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">
          Hello, <span className="text-blue-600">{user?.fullName}</span>! 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {getDateLabelGMT7()}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon="🟢"
          label="Status"
          value={
            attendance?.checkInTime
              ? attendance.checkOutTime
                ? 'Checked Out'
                : 'Checked In'
              : 'Not Checked In'
          }
          color={
            attendance?.checkInTime
              ? attendance.checkOutTime
                ? 'border-l-gray-400'
                : 'border-l-green-500'
              : 'border-l-yellow-500'
          }
        />
        <StatCard
          icon="🕐"
          label="Check-in Time"
          value={fmt(attendance?.checkInTime ?? null)}
          color="border-l-blue-500"
        />
        <StatCard
          icon="🕔"
          label="Check-out Time"
          value={fmt(attendance?.checkOutTime ?? null)}
          color="border-l-purple-500"
        />
      </div>

      {/* Today's Attendance card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-700">Today's Attendance</h2>

        {loadingAttend ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            {/* Full Day Leave Message */}
            {todayLeave && todayLeave.period === 'full_day' && (
              <div className="rounded-lg border-l-4 border-blue-400 bg-blue-50 px-4 py-4">
                <p className="flex items-center gap-2 text-base font-semibold text-blue-900">
                  🎉 Enjoy your well-deserved day off!
                </p>
                <p className="mt-2 text-sm text-blue-700">
                  Your approved leave covers the entire day. Relax and recharge!
                </p>
              </div>
            )}

            {/* Half Day Leave Info */}
            {todayLeave && todayLeave.period !== 'full_day' && (
              <div className="mb-4 rounded-lg border-l-4 border-amber-300 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-900">
                  ⏰ Half-day leave: {todayLeave.period === 'half_day_morning' ? 'Morning' : 'Afternoon'} off
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  Check in/out for the {todayLeave.period === 'half_day_morning' ? 'afternoon' : 'morning'} shift below.
                </p>
              </div>
            )}

            {/* Feedback */}
            {actionMsg && (
              <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                {actionMsg}
              </div>
            )}
            {actionError && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {actionError}
              </div>
            )}

            {/* Info */}
            {attendance?.checkInTime && (
              <div className="mb-4 space-y-1 text-sm text-gray-600">
                <p>
                  <span className="font-medium">Check-in:</span>{' '}
                  {new Date(attendance.checkInTime).toLocaleString()}
                </p>
                {attendance.checkOutTime && (
                  <p>
                    <span className="font-medium">Check-out:</span>{' '}
                    {new Date(attendance.checkOutTime).toLocaleString()}
                  </p>
                )}
                <p>
                  <span className="font-medium">Status:</span>{' '}
                  <span
                    className={`capitalize ${
                      attendance.status === 'present'
                        ? 'text-green-600'
                        : attendance.status === 'late'
                          ? 'text-yellow-600'
                          : 'text-red-600'
                    }`}
                  >
                    {attendance.status}
                  </span>
                </p>
              </div>
            )}

            {/* Shift Times for Half-Day */}
            {todayLeave && todayLeave.period !== 'full_day' && workingHours && (
              <div className="mb-4 rounded-lg bg-gray-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {todayLeave.period === 'half_day_morning' ? 'Afternoon' : 'Morning'} Shift
                </p>
                <p className="mt-2 font-mono text-sm font-semibold text-gray-900">
                  {todayLeave.period === 'half_day_morning'
                    ? `${workingHours.afternoonStart} – ${workingHours.afternoonEnd}`
                    : `${workingHours.morningStart} – ${workingHours.morningEnd}`}
                </p>
              </div>
            )}

            {/* Buttons - Hidden for Full Day Leave */}
            {!todayLeave || todayLeave.period !== 'full_day' ? (
              <>
                {!attendance?.checkInTime ? (
                  <button
                    onClick={handleCheckIn}
                    disabled={actionLoading}
                    className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
                  >
                    {actionLoading ? 'Processing…' : 'Check In'}
                  </button>
                ) : !attendance.checkOutTime ? (
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
                  >
                    {actionLoading ? 'Processing…' : 'Check Out'}
                  </button>
                ) : (
                  <p className="text-sm font-medium text-gray-500">
                    ✅ Attendance complete for today.
                  </p>
                )}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className={`rounded-xl border-l-4 bg-white p-5 shadow-sm ${color}`}>
      <div className="flex items-center gap-2 text-gray-500">
        <span>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-gray-800">{value}</p>
    </div>
  );
}
