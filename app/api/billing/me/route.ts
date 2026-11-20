import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { activeGrant, planFor, readSub, readUsageCount } from '@/lib/billing';
import { LIMITS, PREMIUM_OPEN } from '@/lib/plans';
import { stripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';

// GET → the signed-in person's plan, limits and today's FateBot use.
export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ plan: 'free', limits: LIMITS.free, signedIn: false, billing: stripeEnabled(), premiumOpen: PREMIUM_OPEN });
  const sub = await readSub(u.uid);
  const plan = await planFor(u);
  const grant = await activeGrant(u.uid);
  return NextResponse.json({
    signedIn: true, billing: stripeEnabled(), premiumOpen: PREMIUM_OPEN, plan, limits: LIMITS[plan],
    status: sub.status, interval: sub.interval, periodEnd: sub.periodEnd, trialEnd: sub.trialEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    trialAvailable: !sub.trialUsed, hasCustomer: !!sub.customerId,
    askedToday: await readUsageCount(u.uid, 'ask'),
    grantUntil: grant?.until,
  });
}
