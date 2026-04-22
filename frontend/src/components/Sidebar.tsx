import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/calendar', label: 'My Calendar', icon: '📅' },
  { to: '/leaves', label: 'Leave Requests', icon: '📋' },
  { to: '/payroll', label: 'My Payslip', icon: '💵' },
  { to: '/admin/dashboard', label: 'Admin Dashboard', icon: '📈', adminOnly: true },
  { to: '/admin/employees', label: 'Employees', icon: '👥', adminOnly: true },
  { to: '/admin/leaves', label: 'Approve Leaves', icon: '✔️', adminOnly: true },
  { to: '/admin/payroll', label: 'Payroll', icon: '💰', adminOnly: true },
  { to: '/admin/reports', label: 'Reports', icon: '📊', adminOnly: true },
  { to: '/admin/working-hours', label: 'Working Hours', icon: '⏰', adminOnly: true },
];

const filterNavItems = (items: NavItem[], isAdmin: boolean): NavItem[] => {
  if (isAdmin) {
    // Admin only sees admin items
    return items.filter((item) => item.adminOnly);
  }
  // Employee sees non-admin items
  return items.filter((item) => !item.adminOnly);
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-gray-900 text-white shadow-xl">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-gray-700 px-6 py-5">
        <span className="text-2xl">☀️</span>
        <div>
          <p className="text-sm font-bold leading-tight">Sunpro</p>
          <p className="text-xs text-gray-400">Employee Portal</p>
        </div>
      </div>

      {/* User badge */}
      <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold uppercase">
            {user?.fullName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user?.fullName}</p>
            <p className="truncate text-xs capitalize text-gray-400">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {filterNavItems(navItems, user?.role === 'admin').map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-700 p-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-red-600 hover:text-white"
        >
          <span>🚪</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
