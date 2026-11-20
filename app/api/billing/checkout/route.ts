import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { readSub, writeSub } from '@/lib/billing';
import { PREMIUM_OPEN, TRIAL_DAYS } from '@/lib/plans';
import { priceFor, stripe, stripeEnabled } from '@/lib/stripe';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';

// POST { plan: 'basic'|'premium', interval: 'month'|'year', lang } → Stripe Checkout URL
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  if (!stripeEnabled()) return NextResponse.json({ error: 'billing_off' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const plan = b.plan === 'premium' ? 'premium' : 'basic';
  if (plan === 'premium' && !PREMIUM_OPEN) return NextResponse.json({ error: 'not_open' }, { status: 400 });
  const interval = b.interval === 'year' ? 'year' : 'month';
  const s = stripe();
  const sub = await readSub(u.uid);
  // already paying: send them to manage it instead of a second subscription
  if (sub.subId && ['active', 'trialing', 'past_due'].includes(sub.status)) return NextResponse.json({ error: 'already_subscribed' }, { status: 409 });

  let customerId = sub.customerId;
  if (!customerId) {
    const c = await s.customers.create({ email: u.email, metadata: { fatecal_uid: u.uid } });
    customerId = c.id;
    await writeSub(u.uid, { ...sub, customerId, updatedAt: new Date().toISOString() });
  }
  const session = await s.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: await priceFor(plan, interval), quantity: 1 }],
    subscription_data: {
      metadata: { fatecal_uid: u.uid },
      ...(sub.trialUsed ? {} : { trial_period_days: TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } }),
    },
    payment_method_collection: 'always',
    allow_promotion_codes: true,
    locale: b.lang === 'zh' ? 'zh' : 'en',
    client_reference_id: u.uid,
    success_url: `${SITE_URL}/?billing=success`,
    cancel_url: `${SITE_URL}/?billing=cancel`,
  });
  return NextResponse.json({ url: session.url });
}
