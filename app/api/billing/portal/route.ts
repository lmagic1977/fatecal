import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { readSub } from '@/lib/billing';
import { stripe, stripeEnabled } from '@/lib/stripe';
import { SITE_URL } from '@/lib/site';

export const runtime = 'nodejs';

// POST → Stripe's customer portal: cancel, change card, switch monthly/yearly, invoices.
export async function POST(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
  if (!stripeEnabled()) return NextResponse.json({ error: 'billing_off' }, { status: 503 });
  const sub = await readSub(u.uid);
  if (!sub.customerId) return NextResponse.json({ error: 'no_customer' }, { status: 400 });
  const s = stripe();
  const b = await req.json().catch(() => ({}));
  // make sure a portal setup exists that allows one-tap cancelling
  const configs = await s.billingPortal.configurations.list({ is_default: true, limit: 1 });
  const configuration = configs.data[0]?.id ?? (await s.billingPortal.configurations.create({
    business_profile: { headline: 'FateCal', privacy_policy_url: `${SITE_URL}/privacy`, terms_of_service_url: `${SITE_URL}/terms` },
    features: {
      subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'unused', 'other'] } },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email'] },
    },
  })).id;
  const portal = await s.billingPortal.sessions.create({ customer: sub.customerId, return_url: `${SITE_URL}/?billing=portal`, configuration, locale: b.lang === 'zh' ? 'zh' : 'en' });
  return NextResponse.json({ url: portal.url });
}
