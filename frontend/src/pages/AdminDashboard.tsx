import { useEffect, useState } from 'react';
import axios from '../api/axios';

interface Metrics {
  presentToday: number;
  absentToday: number;
  lateToday: number;
  pendingLeaves: number;
  approvedLeavesToday: number;
  totalEmployees: number;
  draftPayruns: number;
  pendingPayruns: number;
  approvedPayruns: number;
  currentMonthPayroll: string;
  date: string;
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const { data } = await axios.get('/admin/metrics');
        setMetrics(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Error loading metrics</div>;
  }

  if (!metrics) {
    return <div className="p-6 text-center text-gray-500">No data available</div>;
  }

  const attendanceCards = [
    { title: 'Present', value: metrics.presentToday, icon: '✅', color: 'bg-green-50 border-l-4 border-green-500 text-green-800' },
    { title: 'Absent', value: metrics.absentToday, icon: '❌', color: 'bg-red-50 border-l-4 border-red-500 text-red-800' },
    { title: 'Late', value: metrics.lateToday, icon: '⏰', color: 'bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800' },
    { title: 'Total Employees', value: metrics.totalEmployees, icon: '👥', color: 'bg-blue-50 border-l-4 border-blue-500 text-blue-800' },
  ];

  const leaveCards = [
    { title: 'Pending Approvals', value: metrics.pendingLeaves, icon: '⏳', color: 'bg-orange-50 border-l-4 border-orange-500 text-orange-800' },
    { title: 'Approved Today', value: metrics.approvedLeavesToday, icon: '✔️', color: 'bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800' },
  ];

  const payrollCards = [
    { title: 'Draft Runs', value: metrics.draftPayruns, icon: '📝', color: 'bg-slate-50 border-l-4 border-slate-500 text-slate-800', status: 'draft' },
    { title: 'Under Review', value: metrics.pendingPayruns, icon: '👁️', color: 'bg-indigo-50 border-l-4 border-indigo-500 text-indigo-800', status: 'under_review' },
    { title: 'Approved', value: metrics.approvedPayruns, icon: '✓', color: 'bg-lime-50 border-l-4 border-lime-500 text-lime-800', status: 'approved' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          📅 {new Date(metrics.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Attendance Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          📊 Attendance Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {attendanceCards.map((card) => (
            <div
              key={card.title}
              className={`p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow ${card.color}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium opacity-75 mb-1">{card.title}</p>
                  <p className="text-3xl font-bold">{card.value}</p>
                </div>
                <div className="text-3xl">{card.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leave Management Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          🏖️ Leave Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {leaveCards.map((card) => (
            <div
              key={card.title}
              className={`p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow ${card.color}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium opacity-75 mb-1">{card.title}</p>
                  <p className="text-3xl font-bold">{card.value}</p>
                </div>
                <div className="text-3xl">{card.icon}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payroll Section */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          💰 Payroll Status
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {payrollCards.map((card) => (
            <div
              key={card.title}
              className={`p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${card.color}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium opacity-75 mb-1">{card.title}</p>
                  <p className="text-3xl font-bold">{card.value}</p>
                </div>
                <div className="text-3xl">{card.icon}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-purple-500">
          <p className="text-sm text-slate-600">
            <span className="font-semibold text-slate-800">Current Month:</span> {metrics.currentMonthPayroll}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border-t-4 border-blue-500">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            ⚡ Quick Actions
          </h3>
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded text-sm text-slate-700 font-medium transition-colors">
              → Run Payroll for Current Month
            </button>
            <button className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded text-sm text-slate-700 font-medium transition-colors">
              → Review Pending Leaves
            </button>
            <button className="w-full text-left px-3 py-2 hover:bg-blue-50 rounded text-sm text-slate-700 font-medium transition-colors">
              → Configure Working Hours
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-t-4 border-emerald-500">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            📈 System Health
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Data Sync</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">✓ Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">API Status</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">✓ Online</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Database</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">✓ Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-slate-100 rounded-lg p-4 text-xs text-slate-600 border border-slate-200">
        <p>
          Dashboard auto-refreshes every 30 seconds. Last updated: {new Date().toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
