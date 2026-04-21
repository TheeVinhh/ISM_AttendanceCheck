/**
 * Timezone utility for GMT+7 (Bangkok Time / Indochina Time)
 * Uses the Intl API with timeZone option to avoid double-shift bugs.
 */

const TIMEZONE = 'Asia/Bangkok';

/**
 * Get today's date in GMT+7 as YYYY-MM-DD
 */
export const getTodayGMT7 = (): string =>
  new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });

/**
 * Format ISO string to GMT+7 time string (HH:MM AM/PM)
 */
export const formatTimeGMT7 = (isoString: string | null): string => {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIMEZONE,
  });
};

/**
 * Get current year and month in GMT+7
 */
export const getCurrentYearMonthGMT7 = (): { year: number; month: number } => {
  const now = new Date();
  const year = parseInt(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: TIMEZONE }).format(now));
  const month = parseInt(new Intl.DateTimeFormat('en', { month: 'numeric', timeZone: TIMEZONE }).format(now));
  return { year, month };
};

/**
 * Format a date for display in GMT+7 (e.g. "Monday, April 21, 2026")
 */
export const getDateLabelGMT7 = (date: Date = new Date()): string =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: TIMEZONE,
  });

/**
 * Format a short date in GMT+7 (e.g. "Apr 21, 2026")
 */
export const getShortDateGMT7 = (isoString: string): string =>
  new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: TIMEZONE,
  });
