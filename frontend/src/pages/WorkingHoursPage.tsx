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
      <div className="p-6 text-center text-gray-400">
        Loading working hours configuration…
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Working Hours Configuration</h1>
      <p className="text-sm text-gray-600 mb-6">
        Configure single-shift or two-shift schedule. Break time is not counted as paid hours for hourly employees.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Legacy Single Shift */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-900">Single Shift Configuration (Legacy)</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-In Time (Expected)
              </label>
              <input
                type="time"
                name="checkInTime"
                value={formData.checkInTime}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                When employees should check in
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Check-Out Time (Expected)
              </label>
              <input
                type="time"
                name="checkOutTime"
                value={formData.checkOutTime}
                onChange={handleChange}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                When employees should check out
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Late Threshold (minutes)
            </label>
            <input
              type="number"
              name="lateThresholdMinutes"
              value={formData.lateThresholdMinutes}
              onChange={handleChange}
              min="0"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Grace period after check-in before marked as late (0 = any time after check-in time is late)
            </p>
          </div>
        </div>

        {/* Two-Shift Configuration */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-lg font-semibold mb-4 text-blue-900">Two-Shift Configuration</h2>
          <p className="text-sm text-blue-700 mb-4">
            For organizations with morning and afternoon shifts. Break time is not counted as paid hours.
          </p>

          <div className="space-y-4">
            {/* Morning Shift */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Morning Shift</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="morningStart"
                    value={formData.morningStart}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    name="morningEnd"
                    value={formData.morningEnd}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Break Duration */}
            <div className="bg-white rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Break Duration (minutes)
              </label>
              <input
                type="number"
                name="breakMinutes"
                value={formData.breakMinutes}
                onChange={handleChange}
                min="0"
                step="15"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Break between shifts. Not counted as paid hours for hourly employees.
              </p>
            </div>

            {/* Afternoon Shift */}
            <div className="bg-white rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Afternoon Shift</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="afternoonStart"
                    value={formData.afternoonStart}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Time
                  </label>
                  <input
                    type="time"
                    name="afternoonEnd"
                    value={formData.afternoonEnd}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3 pt-6 border-t border-gray-200">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* Current Configuration Display */}
      {config && (
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-4">Current Configuration</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Single Shift Check-In:</span>
              <span className="font-mono font-semibold text-gray-900">{config.checkInTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Single Shift Check-Out:</span>
              <span className="font-mono font-semibold text-gray-900">{config.checkOutTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Morning: {config.morningStart} — {config.morningEnd}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Break:</span>
              <span className="font-mono font-semibold text-gray-900">{config.breakMinutes} mins</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Afternoon: {config.afternoonStart} — {config.afternoonEnd}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
