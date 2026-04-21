import { useState, FormEvent, useEffect } from 'react';
import axios from 'axios';
import api from '../api/axios';
import { getShortDateGMT7 } from '../utils/timezone';
import type { LeaveRequest, LeaveType, LeavePeriod } from '../types';

export default function LeavesPage() {
  const [date, setDate] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('with_salary');
  const [period, setPeriod] = useState<LeavePeriod>('full_day');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [balanceWithSalary, setBalanceWithSalary] = useState(12);
  const [balanceWithoutSalary, setBalanceWithoutSalary] = useState(31);

  const fetchLeaves = async () => {
    setLeavesLoading(true);
    try {
      const { data } = await api.get<{ leaves: LeaveRequest[] }>('/leaves/my');
      setLeaves(data.leaves);
      // Calculate balance
      const withSalaryUsed = data.leaves.filter(
        (l) => l.leaveType === 'with_salary' && l.status === 'approved'
      ).length;
      const withoutSalaryUsed = data.leaves.filter(
        (l) => l.leaveType === 'without_salary' && l.status === 'approved'
      ).length;
      setBalanceWithSalary(12 - withSalaryUsed);
      setBalanceWithoutSalary(31 - withoutSalaryUsed);
    } finally {
      setLeavesLoading(false);
    }
  };

  useEffect(() => {
    void fetchLeaves();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg('');
    setError('');
    setLoading(true);
    try {
      await api.post('/leaves', { date, leaveType, period, reason });
      setMsg('Leave request submitted successfully!');
      setDate('');
      setReason('');
      setPeriod('full_day');
      void fetchLeaves();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError((err.response?.data as { message?: string })?.message ?? 'Submission failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPeriodLabel = (p: LeavePeriod) => {
    switch (p) {
      case 'full_day':
        return 'Full Day';
      case 'half_day_morning':
        return 'Morning Only';
      case 'half_day_afternoon':
        return 'Afternoon Only';
    }
  };

  const getDateGMT7 = (isoString: string) => getShortDateGMT7(isoString);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Leave Requests</h1>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm font-medium text-blue-600">Paid Leave Balance</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">{balanceWithSalary} / 12 days</p>
          <p className="text-xs text-blue-700 mt-2">Resets annually on Jan 1</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
          <p className="text-sm font-medium text-purple-600">Unpaid Leave Balance</p>
          <p className="text-3xl font-bold text-purple-900 mt-1">{balanceWithoutSalary} / 31 days</p>
          <p className="text-xs text-purple-700 mt-2">Resets annually on Jan 1</p>
        </div>
      </div>

      {/* Submit Form */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Submit New Request</h2>
        {msg && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{msg}</div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Leave Type</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="with_salary">Paid Leave (12 days/year)</option>
                <option value="without_salary">Unpaid Leave (31 days/year)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Leave Duration</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="flex items-center rounded-lg border border-gray-300 p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="period"
                  value="full_day"
                  checked={period === 'full_day'}
                  onChange={(e) => setPeriod(e.target.value as LeavePeriod)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Full Day</span>
              </label>
              <label className="flex items-center rounded-lg border border-gray-300 p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="period"
                  value="half_day_morning"
                  checked={period === 'half_day_morning'}
                  onChange={(e) => setPeriod(e.target.value as LeavePeriod)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Morning Only</span>
              </label>
              <label className="flex items-center rounded-lg border border-gray-300 p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="period"
                  value="half_day_afternoon"
                  checked={period === 'half_day_afternoon'}
                  onChange={(e) => setPeriod(e.target.value as LeavePeriod)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">Afternoon Only</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe your reason for leave…"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </form>
      </div>

      {/* Leave History */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Your Leave History</h2>

        {leavesLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : leaves.length === 0 ? (
          <p className="text-sm text-gray-400">No leave requests yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Duration</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Reason</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((leave) => (
                  <tr key={leave._id} className={`border-b border-gray-100 ${getStatusColor(leave.status)}`}>
                    <td className="px-4 py-3 font-medium">
                      {new Date(leave.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold uppercase">
                      {leave.leaveType === 'with_salary' ? '💰 Paid' : '📭 Unpaid'}
                    </td>
                    <td className="px-4 py-3">{getPeriodLabel(leave.period)}</td>
                    <td className="px-4 py-3 max-w-xs truncate">{leave.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(leave.status)}`}>
                        {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
