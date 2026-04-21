import { useEffect, useState } from 'react';
import axios from '../api/axios';
import { getTodayGMT7 } from '../utils/timezone';

interface Employee {
  _id: string;
  fullName: string;
  email: string;
  createdAt: string;
  todayStatus: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resetLoading, setResetLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data } = await axios.get('/admin/employees');
        setEmployees(data.employees);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const handleResetToday = async (userId: string) => {
    const today = getTodayGMT7();
    try {
      setResetLoading(userId);
      await axios.post(`/admin/reset-attendance/${userId}/${today}`);
      // Refresh the employee list
      const { data } = await axios.get('/admin/employees');
      setEmployees(data.employees);
      alert('Attendance reset successfully');
    } catch (err) {
      alert(`Error resetting attendance: ${String(err)}`);
    } finally {
      setResetLoading(null);
    }
  };

  const getStatusColor = (status: string): string => {
    if (status === 'on time') return 'bg-green-100 text-green-800';
    if (status === 'late') return 'bg-yellow-100 text-yellow-800';
    if (status === 'not checked in') return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="p-6 text-center">Loading employees...</div>;
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">Employees</h1>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 px-4 py-2 text-left">Name</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Email</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Status Today</th>
              <th className="border border-gray-300 px-4 py-2 text-left">Joined</th>
              <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp._id} className="hover:bg-gray-50">
                <td className="border border-gray-300 px-4 py-2 font-semibold">{emp.fullName}</td>
                <td className="border border-gray-300 px-4 py-2">{emp.email}</td>
                <td className="border border-gray-300 px-4 py-2">
                  <span className={`px-3 py-1 rounded text-xs font-semibold ${getStatusColor(emp.todayStatus)}`}>
                    {emp.todayStatus}
                  </span>
                </td>
                <td className="border border-gray-300 px-4 py-2">
                  {new Date(emp.createdAt).toLocaleDateString()}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  <button
                    onClick={() => handleResetToday(emp._id)}
                    disabled={resetLoading === emp._id}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50"
                  >
                    {resetLoading === emp._id ? 'Resetting...' : 'Reset Today'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {employees.length === 0 && (
        <p className="text-center text-gray-500 mt-4">No employees found</p>
      )}
    </div>
  );
}
