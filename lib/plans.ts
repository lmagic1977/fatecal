// FateCal plans. Prices live in Stripe under these lookup keys; the app creates them on first use.
export type Plan = 'free' | 'basic' | 'premium';
export type Interval = 'month' | 'year';

export const PRICES: Record<Exclude<Plan, 'free'>, Record<Interval, { cents: number; lookup: string }>> = {
  basic: { month: { cents: 599, lookup: 'fatecal_basic_monthly' }, year: { cents: 4799, lookup: 'fatecal_basic_yearly' } },
  premium: { month: { cents: 999, lookup: 'fatecal_premium_monthly' }, year: { cents: 7999, lookup: 'fatecal_premium_yearly' } },
};
export const TRIAL_DAYS = 7;
// Premium checkout opens once its own features (compatibility, morning email) ship.
export const PREMIUM_OPEN = false;

export interface Limits {
  askPerDay: number;       // FateBot questions per day
  photos: boolean;         // photo questions
  manualPerDay: number;    // events you can add per day
  syncCalendar: boolean;   // Google Calendar + iCal
  mailForwarding: boolean; // forwarding address
  fullReasons: boolean;    // move suggestions and full why
  nextYearStars: boolean;  // next year's flying stars
  homeChecksPerMonth: number;
}
export const LIMITS: Record<Plan, Limits> = {
  free: { askPerDay: 3, photos: false, manualPerDay: 3, syncCalendar: false, mailForwarding: false, fullReasons: false, nextYearStars: false, homeChecksPerMonth: 1 },
  basic: { askPerDay: 30, photos: true, manualPerDay: 1000, syncCalendar: true, mailForwarding: true, fullReasons: true, nextYearStars: true, homeChecksPerMonth: 3 },
  premium: { askPerDay: 200, photos: true, manualPerDay: 1000, syncCalendar: true, mailForwarding: true, fullReasons: true, nextYearStars: true, homeChecksPerMonth: 1000 },
};
export const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Free-access codes. Each person can use one code once; `max` is the total number of people.
// A link like https://fatecal.com/?code=FATECAL2027 fills it in automatically after sign-up.
export const PROMOS: Record<string, { plan: Exclude<Plan, 'free'>; days: number; max: number }> = {
  FATECAL2027: { plan: 'basic', days: 365, max: 100 },
};
