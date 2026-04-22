import { useEffect, useState } from 'react';
import axios from '../api/axios';

interface WorkingHoursConfig {
  _id: string;
  checkInTime: string;
  checkOutTime: string;
  lateThresholdMinutes: number;
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  breakMinutes: number;
}

export default function WorkingHoursPage() {
  const [config, setConfig] = useState<WorkingHoursConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    checkInTime: '09:00',
    checkOutTime: '17:00',
    lateThresholdMinutes: 0,
    morningStart: '08:00',
    morningEnd: '12:00',
    afternoonStart: '13:30',
    afternoonEnd: '17:30',
    breakMinutes: 90,
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await axios.get('/admin/working-hours');
        setConfig(data.config);
        setFormData({
          checkInTime: data.config.checkInTime,
          checkOutTime: data.config.checkOutTime,
          lateThresholdMinutes: data.config.lateThresholdMinutes,
          morningStart: data.config.morningStart,
          morningEnd: data.config.morningEnd,
          afternoonStart: data.config.afternoonStart,
          afternoonEnd: data.config.afternoonEnd,
          breakMinutes: data.config.breakMinutes,
        });
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'lateThresholdMinutes' || name === 'breakMinutes' ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await axios.put('/admin/working-hours', formData);
      setSuccess('Working hours configuration updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(`Failed to update: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        Loading working hours configuration…
      </div>
    );
  }

  const inputCls = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition';
  const labelCls = 'mb-1.5 block text-sm font-semibold text-gray-700';
  const helpCls = 'mt-1.5 text-xs text-gray-500';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Working Hours</h1>
        <p className="mt-1 text-sm text-gray-500">
          Define the expected shift schedule and late threshold. Break time is excluded from paid hours for hourly employees.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Standard Shift Card */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-lg">🕗</div>
              <div>
                <h2 className="font-semibold text-gray-900">Standard Shift</h2>
                <p className="text-xs text-gray-500">Primary check-in / check-out window used for attendance</p>
              </div>
            </div>
          </div>
          <div className="grid gap-5 p-6 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Check-In Time</label>
              <input type="time" name="checkInTime" value={formData.checkInTime} onChange={handleChange} className={inputCls} />
              <p className={helpCls}>When employees are expected to arrive</p>
            </div>
            <div>
              <label className={labelCls}>Check-Out Time</label>
              <input type="time" name="checkOutTime" value={formData.checkOutTime} onChange={handleChange} className={inputCls} />
              <p className={helpCls}>When employees are expected to leave</p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Late Threshold <span className="font-normal text-gray-400">(minutes)</span></label>
              <div className="flex items-center gap-3">
                <input
                  type="number" name="lateThresholdMinutes" value={formData.lateThresholdMinutes}
                  onChange={handleChange} min="0" step="5"
                  className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <span className="text-sm text-gray-500">minutes grace period after check-in time</span>
              </div>
              <p className={helpCls}>0 = any arrival after check-in time counts as late</p>
            </div>
          </div>
        </div>

        {/* Two-Shift Card */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-lg">⏱️</div>
              <div>
                <h2 className="font-semibold text-gray-900">Two-Shift Schedule</h2>
                <p className="text-xs text-gray-500">Morning & afternoon shifts with a break between. Break is unpaid for hourly employees.</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Morning Shift */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Morning Shift</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Start Time</label>
                  <input type="time" name="morningStart" value={formData.morningStart} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End Time</label>
                  <input type="time" name="morningEnd" value={formData.morningEnd} onChange={handleChange} className={inputCls} />
                </div>
              </div>
            </div>

            {/* Break */}
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-600">Break Duration</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number" name="breakMinutes" value={formData.breakMinutes}
                    onChange={handleChange} min="0" step="15"
                    className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <span className="text-sm text-gray-500">minutes — unpaid for hourly staff</span>
                </div>
              </div>
            </div>

            {/* Afternoon Shift */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Afternoon Shift</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Start Time</label>
                  <input type="time" name="afternoonStart" value={formData.afternoonStart} onChange={handleChange} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End Time</label>
                  <input type="time" name="afternoonEnd" value={formData.afternoonEnd} onChange={handleChange} className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Card */}
        {config && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Active Schedule</p>
            <div className="grid gap-2 sm:grid-cols-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Standard:</span>
                <span className="font-mono font-semibold text-gray-900">{config.checkInTime} – {config.checkOutTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Morning:</span>
                <span className="font-mono font-semibold text-gray-900">{config.morningStart} – {config.morningEnd}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Afternoon:</span>
                <span className="font-mono font-semibold text-gray-900">{config.afternoonStart} – {config.afternoonEnd}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Break:</span>
                <span className="font-mono font-semibold text-gray-900">{config.breakMinutes} min</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Late after:</span>
                <span className="font-mono font-semibold text-gray-900">{config.lateThresholdMinutes} min</span>
              </div>
            </div>
          </div>
        )}

        {/* Save */}
        <div className="flex items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-xs text-gray-500 mr-auto">Changes apply immediately to all future payroll calculations.</p>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

      </form>
    </div>
  );
}
