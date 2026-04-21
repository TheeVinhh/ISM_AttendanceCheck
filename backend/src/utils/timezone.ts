/**
 * Timezone utility for GMT+7 (Bangkok Time / Indochina Time)
 */

const GMT_OFFSET = 7; // hours

/**
 * Get current time in GMT+7
 */
export const nowGMT7 = (): Date => {
  const utc = new Date();
  const gmtTime = new Date(utc.getTime() + GMT_OFFSET * 60 * 60 * 1000);
  return gmtTime;
};

/**
 * Get today's date as YYYY-MM-DD in GMT+7
 */
export const todayGMT7 = (): string => {
  const gmt7 = nowGMT7();
  return gmt7.toISOString().slice(0, 10);
};

/**
 * Convert any ISO string to GMT+7 date
 */
export const toGMT7Date = (isoString: string): Date => {
  return new Date(new Date(isoString).getTime() + GMT_OFFSET * 60 * 60 * 1000);
};

/**
 * Get hour in GMT+7
 */
export const getHourGMT7 = (date: Date): number => {
  return Math.floor(date.getTime() / (1000 * 60 * 60)) % 24;
};

/**
 * Get minute in GMT+7
 */
export const getMinuteGMT7 = (date: Date): number => {
  return Math.floor((date.getTime() / (1000 * 60)) % 60);
};
