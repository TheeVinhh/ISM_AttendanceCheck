// Shared domain types

export type Role = 'employee' | 'admin';
export type AuthProvider = 'local' | 'azure';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half-day';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'with_salary' | 'without_salary';
export type LeavePeriod = 'full_day' | 'half_day_morning' | 'half_day_afternoon';

export interface JwtPayload {
  id: string;
  email: string;
  role: Role;
  fullName: string;
}
