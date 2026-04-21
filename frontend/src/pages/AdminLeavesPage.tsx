import { useEffect, useState } from 'react';
import axios from 'axios';
import api from '../api/axios';
import type { LeaveRequest, LeaveStatus, LeaveType, LeavePeriod } from '../types';

interface PopulatedLeave extends Omit<LeaveRequest, 'userId'> {
  userId: { _id: string; fullName: string; email: string };
}

const STATUS_STYLES: Record<LeaveStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function AdminLeavesPage() {
  const [leaves, setLeaves] = useState<PopulatedLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const fetchLeaves = async () => {
    try {
      const { data } = await api.get<{ leaves: PopulatedLeave[] }>('/leaves');
      setLeaves(data.leaves);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchLeaves();
  }, []);

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setProcessing(id);
    setFeedback('');
    try {
      await api.patch(`/leaves/${id}`, { status });
      setLeaves((prev) =>
        prev.map((l) => (l._id === id ? { ...l, status } : l)),
      );
      setFeedback(`Leave ${status} successfully.`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setFeedback((err.response?.data as { message?: string })?.message ?? 'Action failed');
      }
    } finally {
      setProcessing(null);
    }
  };

  const getLeaveTypeLabel = (leaveType: LeaveType) => {
    return leaveType === 'with_salary' ? '💰 Paid' : '📭 Unpaid';
  };

  const getPeriodLabel = (period: LeavePeriod) => {
    switch (period) {
      case 'full_day':
        return 'Full Day';
      case 'half_day_morning':
        return 'Morning Only';
      case 'half_day_afternoon':
        return 'Afternoon Only';
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-gray-900">Leave Requests</h1>

      {feedback && (
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {feedback}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : leaves.length === 0 ? (
        <p className="text-sm text-gray-500">No leave requests found.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaves.map((leave) => (
                  <tr key={leave._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{leave.userId.fullName}</div>
                      <div className="text-xs text-gray-400">{leave.userId.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{leave.date}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                      {getLeaveTypeLabel(leave.leaveType)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{getPeriodLabel(leave.period)}</td>
                    <td className="max-w-xs px-4 py-3 text-gray-600">
                      <p className="line-clamp-2">{leave.reason}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[leave.status]}`}
                      >
                        {leave.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {leave.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateStatus(leave._id, 'approved')}
                            disabled={processing === leave._id}
                            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(leave._id, 'rejected')}
                            disabled={processing === leave._id}
                            className="rounded-md bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
