import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';
import { getTodayGMT7, formatTimeGMT7, getCurrentYearMonthGMT7 } from '../utils/timezone';
import type { AttendanceRecord, LeaveRequest } from '../types';

interface MonthlyData {
  records: AttendanceRecord[];
  leaves: LeaveRequest[];
}

type CellType = 'present' | 'late' | 'absent-checkout' | 'approved-leave' | 'pending-leave' | 'rejected-leave' | 'weekend' | 'future' | 'empty';

interface DayInfo {
  day: number;
  dateStr: string;
  type: CellType;
  checkIn?: string;
  checkOut?: string;
  leaveLabel?: string;
  attendanceId?: string;
  otAssigned?: boolean;
  otCheckOut?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const cellStyle: Record<CellType, string> = {
  present: 'bg-green-500 text-white',
  late: 'bg-yellow-400 text-gray-900',
  'absent-checkout': 'bg-red-500 text-white',
  'approved-leave': 'bg-green-300 text-green-900',
  'pending-leave': 'bg-blue-300 text-blue-900',
  'rejected-leave': 'bg-red-200 text-red-900',
  weekend: 'bg-transparent text-gray-400',
  future: 'bg-gray-100 text-gray-400',
  empty: 'bg-transparent',
};

export default function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { year: initYear, month: initMonth } = getCurrentYearMonthGMT7();
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  const [data, setData] = useState<MonthlyData>({ records: [], leaves: [] });
  const [loading, setLoading] = useState(false);
  const [otModal, setOtModal] = useState<{ dateStr: string; attendanceId: string; current?: string } | null>(null);
  const [otTime, setOtTime] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get<MonthlyData>('/attendance/monthly', {
        params: { year, month },
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [year, month]);

  const handleAssignOT = async (remove = false) => {
    if (!otModal) return;
    setAssigning(true);
    try {
      await api.post(`/admin/attendance/${otModal.attendanceId}/assign-ot`, {
        otAssignedCheckOutTime: remove ? undefined : otTime || undefined,
        remove,
      });
      setOtModal(null);
      setOtTime('');
      void fetchData();
    } catch {
      alert('Failed to update OT assignment');
    } finally {
      setAssigning(false);
    }
  };

  // Build calendar grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = getTodayGMT7();

  const recordMap = new Map(data.records.map((r) => [r.date, r]));
  const leaveMap = new Map(data.leaves.map((l) => [l.date, l]));

  const classify = (dateStr: string): DayInfo => {
    const d = new Date(dateStr);
    const dow = d.getDay();
    const day = d.getDate();

    if (dow === 0 || dow === 6) return { day, dateStr, type: 'weekend' };
    if (dateStr > todayStr) {
      // Future day — still show pending leave requests
      const leave = leaveMap.get(dateStr);
      if (leave?.status === 'approved') return { day, dateStr, type: 'approved-leave', leaveLabel: leave.reason };
      if (leave?.status === 'pending') return { day, dateStr, type: 'pending-leave', leaveLabel: leave.reason };
      return { day, dateStr, type: 'future' };
    }

    const leave = leaveMap.get(dateStr);
    const rec = recordMap.get(dateStr);

    const checkIn = rec?.checkInTime ? formatTimeGMT7(rec.checkInTime) : undefined;
    const checkOut = rec?.checkOutTime ? formatTimeGMT7(rec.checkOutTime) : undefined;
    const otAssigned = (rec as any)?.otAssignedByAdmin ?? false;
    const otCheckOut = (rec as any)?.otAssignedCheckOutTime;
    const attendanceId = rec?._id;

    // Approved leave takes priority (but show check-in times if they exist)
    if (leave?.status === 'approved') return { day, dateStr, type: 'approved-leave', checkIn, checkOut, leaveLabel: leave.reason, attendanceId, otAssigned, otCheckOut };

    // No attendance record
    if (!rec) {
      if (leave?.status === 'pending') return { day, dateStr, type: 'pending-leave', leaveLabel: leave.reason };
      if (leave?.status === 'rejected') return { day, dateStr, type: 'rejected-leave', leaveLabel: leave.reason };
      return { day, dateStr, type: 'absent-checkout' };
    }

    // Has attendance record — checked in but not out: green if on time, yellow if late
    if (!rec.checkOutTime) {
      if (rec.status === 'late') return { day, dateStr, type: 'late', checkIn, attendanceId, otAssigned, otCheckOut };
      return { day, dateStr, type: 'present', checkIn, attendanceId, otAssigned, otCheckOut };
    }

    // Fully checked out
    if (rec.status === 'late') return { day, dateStr, type: 'late', checkIn, checkOut, attendanceId, otAssigned, otCheckOut };
    return { day, dateStr, type: 'present', checkIn, checkOut, attendanceId, otAssigned, otCheckOut };
  };

  // Cells array: leading empties + day cells
  const cells: (DayInfo | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return classify(dateStr);
    }),
  ];

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Monthly Attendance Calendar</h1>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
          ← Prev
        </button>
        <span className="text-base font-semibold text-gray-700">
          {MONTHS[month - 1]} {year}
        </span>
        <button onClick={nextMonth} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100">
          Next →
        </button>
      </div>

          {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { color: 'bg-green-500', label: 'Present' },
          { color: 'bg-yellow-400', label: 'Late' },
          { color: 'bg-red-500', label: 'Absent' },
          { color: 'bg-green-300', label: 'Approved leave' },
          { color: 'bg-blue-300', label: 'Pending leave' },
          { color: 'bg-red-200', label: 'Rejected leave' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`h-3 w-3 rounded-full ${color}`} />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-purple-600" />
            <span className="text-gray-600">OT assigned</span>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {/* Day headers */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold uppercase text-gray-500">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) =>
              cell === null ? (
                <div key={`empty-${i}`} className="h-16 rounded-lg" />
              ) : (
                <div
                  key={cell.dateStr}
                  className={`relative h-16 rounded-lg p-1 text-xs transition cursor-pointer hover:shadow-md ${cellStyle[cell.type]} ${isAdmin && cell.attendanceId ? 'hover:opacity-80' : ''} ${cell.otAssigned ? 'ring-2 ring-purple-600' : ''}`}
                  onClick={() => {
                    if (isAdmin && cell.attendanceId && (cell.type === 'present' || cell.type === 'late')) {
                      setOtModal({ dateStr: cell.dateStr, attendanceId: cell.attendanceId, current: cell.otCheckOut });
                      setOtTime(cell.otCheckOut || '');
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold">{cell.day}</span>
                    {cell.otAssigned && <span className="text-xs font-bold text-purple-600">⚙️</span>}
                  </div>
                  {cell.checkIn && (
                    <div className="mt-0.5 leading-tight opacity-90">
                      <div>{cell.checkIn}</div>
                      {cell.checkOut && <div>{cell.checkOut}</div>}
                      {cell.otAssigned && <div className="text-purple-600 font-semibold">OT: {cell.otCheckOut}</div>}
                    </div>
                  )}
                  {cell.type === 'approved-leave' && !cell.checkIn && (
                    <div className="mt-0.5 font-medium truncate">✓ {cell.leaveLabel ?? 'Leave'}</div>
                  )}
                  {cell.type === 'pending-leave' && (
                    <div className="mt-0.5 font-medium truncate">⏳ {cell.leaveLabel ?? 'Pending'}</div>
                  )}
                  {cell.type === 'rejected-leave' && (
                    <div className="mt-0.5 font-medium truncate">✗ {cell.leaveLabel ?? 'Rejected'}</div>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* OT Assignment Modal (Admin only) */}
      {otModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl w-full max-w-md">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <h2 className="text-lg font-bold text-gray-800">Assign OT Checkout Time</h2>
              <button onClick={() => setOtModal(null)} className="rounded-lg px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✕</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-gray-600">Date: {otModal.dateStr}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-600">Checkout Time (HH:MM)</label>
                <input
                  type="time"
                  value={otTime}
                  onChange={(e) => setOtTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="mt-2 text-xs text-gray-500">Example: 18:00 (6 PM)</p>
              </div>
              {otModal.current && (
                <p className="text-xs bg-blue-50 p-2 rounded text-blue-800">Current OT checkout: {otModal.current}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setOtModal(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAssignOT()}
                  disabled={assigning || !otTime}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                >
                  {assigning ? 'Saving...' : 'Assign OT'}
                </button>
                {otModal.current && (
                  <button
                    onClick={() => void handleAssignOT(true)}
                    disabled={assigning}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {assigning ? 'Removing...' : 'Remove OT'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
