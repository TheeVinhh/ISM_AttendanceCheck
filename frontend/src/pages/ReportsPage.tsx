import { useEffect, useState } from 'react';
import axios from '../api/axios';
import { formatTimeGMT7 } from '../utils/timezone';

interface AttendanceRecord {
  _id: string;
  date: string;
  checkInTime?: string;
  checkOutTime?: string;
  status: string;
  notes?: string;
}

interface LeaveRecord {
  _id: string;
  date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface Employee {
  _id: string;
  fullName: string;
  email: string;
}

interface EmployeeCalendar {
  employee: Employee;
  month: number;
  year: number;
  records: AttendanceRecord[];
  leaves: LeaveRecord[];
}

const statusColors: Record<string, string> = {
  present: 'bg-green-100 text-green-800',
  late: 'bg-yellow-100 text-yellow-800',
  absent: 'bg-red-100 text-red-800',
  'half-day': 'bg-orange-100 text-orange-800',
};

const statusEmojis: Record<string, string> = {
  present: '✅',
  late: '⏰',
  absent: '❌',
  'half-day': '⚠️',
};

export default function ReportsPage() {
  const nowUTC = new Date();
  const nowGMT7 = new Date(nowUTC.getTime() + 7 * 60 * 60 * 1000);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [calendar, setCalendar] = useState<EmployeeCalendar | null>(null);
  const [month, setMonth] = useState(nowGMT7.getMonth() + 1);
  const [year, setYear] = useState(nowGMT7.getFullYear());
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [error, setError] = useState('');
  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data } = await axios.get('/admin/employees');
        const emps = data.employees.map((e: {_id: string, fullName: string, email: string}) => ({
          _id: e._id,
          fullName: e.fullName,
          email: e.email,
        }));
        setEmployees(emps);
        if (emps.length > 0) {
          setSelectedEmployeeId(emps[0]._id);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Fetch calendar when employee or month changes
  useEffect(() => {
    if (!selectedEmployeeId) return;

    const fetchCalendar = async () => {
      try {
        setCalendarLoading(true);
        const { data } = await axios.get(`/admin/employee/${selectedEmployeeId}/calendar`, {
          params: { year, month },
        });
        setCalendar(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setCalendarLoading(false);
      }
    };

    fetchCalendar();
  }, [selectedEmployeeId, month, year]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const getDaysInMonth = (y: number, m: number): number => {
    return new Date(y, m, 0).getDate();
  };

  const getFirstDayOfMonth = (y: number, m: number): number => {
    return new Date(y, m - 1, 1).getDay();
  };

  const getRecordForDate = (date: string): AttendanceRecord | undefined => {
    return calendar?.records.find((r) => r.date === date);
  };

  const getLeaveForDate = (date: string): LeaveRecord | undefined => {
    return calendar?.leaves?.find((l) => l.date === date);
  };

  const leaveColors: Record<string, string> = {
    approved: 'bg-green-100 text-green-800',
    pending: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
  };
  const leaveEmojis: Record<string, string> = {
    approved: '✓',
    pending: '⏳',
    rejected: '✗',
  };

  const exportCSV = async (allEmployees: boolean) => {
    try {
      const data = allEmployees
        ? employees.map(e => e._id)
        : [selectedEmployeeId];

      let csv = 'Date,Employee,Status,Check-In,Check-Out,Notes\n';

      for (const empId of data) {
        if (!empId) continue;
        try {
          const calData = await axios.get(`/admin/employee/${empId}/calendar`, {
            params: { year, month },
          });

          calData.data.records.forEach((record: AttendanceRecord) => {
            const empName = employees.find(e => e._id === empId)?.fullName || 'Unknown';
            const row = [
              record.date,
              empName,
              record.status,
              record.checkInTime ? record.checkInTime.substring(11, 16) : '',
              record.checkOutTime ? record.checkOutTime.substring(11, 16) : '',
              (record.notes || '').replace(/"/g, '""'),
            ]
              .map(cell => `"${cell}"`)
              .join(',');
            csv += row + '\n';
          });
        } catch (err) {
          console.error(`Error fetching calendar for ${empId}:`, err);
        }
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `attendance-report-${year}-${String(month).padStart(2, '0')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(`Error exporting CSV: ${String(err)}`);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading employees...</div>;
  }

  if (employees.length === 0) {
    return <div className="p-6 text-center text-gray-500">No employees found</div>;
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Attendance Reports</h1>

      {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">{error}</div>}

      {/* Export Buttons */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => exportCSV(false)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-semibold"
        >
          📥 Export Current Employee CSV
        </button>
        <button
          onClick={() => exportCSV(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-semibold"
        >
          📥 Export All Employees CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-300 flex gap-2 overflow-x-auto pb-2">
        {employees.map((emp) => (
          <button
            key={emp._id}
            onClick={() => setSelectedEmployeeId(emp._id)}
            className={`px-4 py-2 whitespace-nowrap font-semibold rounded-t transition-colors ${
              selectedEmployeeId === emp._id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {emp.fullName}
          </button>
        ))}
      </div>

      {/* Month Navigation */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={handlePrevMonth}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          ← Previous
        </button>

        <span className="text-lg font-semibold">
          {new Date(year, month - 1).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </span>

        <button
          onClick={handleNextMonth}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Next →
        </button>
      </div>

      {/* Calendar */}
      {calendarLoading && <div className="text-center py-8">Loading calendar...</div>}

      {!calendarLoading && calendar && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-0 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="bg-gray-100 p-3 text-center font-bold text-sm">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0 p-2">
            {/* Empty cells */}
            {emptyDays.map((i) => (
              <div key={`empty-${i}`} className="p-2 border border-gray-200 bg-gray-50 h-24"></div>
            ))}

            {/* Days */}
            {days.map((day) => {
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const record = getRecordForDate(dateStr);
              const leave = getLeaveForDate(dateStr);
              const isWeekend = new Date(year, month - 1, day).getDay() % 6 === 0;

              return (
                <div
                  key={day}
                  className={`p-2 border border-gray-200 h-24 ${
                    isWeekend ? 'bg-gray-50' : 'bg-white'
                  } hover:bg-gray-100 transition-colors`}
                >
                  <div className="text-sm font-bold mb-1">{day}</div>
                  {record ? (
                    <div className="space-y-1">
                      <div className={`px-2 py-1 rounded text-xs font-semibold text-center ${statusColors[record.status] ?? 'bg-gray-100'}`}>
                        {statusEmojis[record.status]} {record.status}
                      </div>
                      {record.checkInTime && (
                        <div className="text-xs text-gray-600">In: {formatTimeGMT7(record.checkInTime)}</div>
                      )}
                      {record.checkOutTime && (
                        <div className="text-xs text-gray-600">Out: {formatTimeGMT7(record.checkOutTime)}</div>
                      )}
                    </div>
                  ) : leave ? (
                    <div className={`px-2 py-1 rounded text-xs font-semibold text-center ${leaveColors[leave.status] ?? 'bg-gray-100'}`}>
                      {leaveEmojis[leave.status]} Leave
                      <div className="text-xs font-normal mt-0.5 truncate" title={leave.reason}>{leave.reason}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
