const TZ = 'Asia/Kolkata';
export const indianDay = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(value));
export function dateRange(from, to) { const startDay = from || indianDay(); const endDay = to || startDay; if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay) || !/^\d{4}-\d{2}-\d{2}$/.test(endDay) || startDay > endDay) throw new Error('Use a valid date range (YYYY-MM-DD)'); return { start: new Date(`${startDay}T00:00:00+05:30`), end: new Date(`${endDay}T23:59:59.999+05:30`) }; }
