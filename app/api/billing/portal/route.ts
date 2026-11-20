import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/guard';
import { readSub } from '@/lib/billing';
import { priceFor, stripe, stripeEnabled } from '@/lib/stripe';
import { PREMIUM_OPEN } from '@/lib/plans';
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
  // Our own portal setup (marked fatecal=v3): one-tap cancel, card, invoices, and switching between
  // Basic monthly ($5.99) and yearly ($47.99) — plus Premium once it opens.
  const plans: ('basic' | 'premium')[] = PREMIUM_OPEN ? ['basic', 'premium'] : ['basic'];
  const products = await Promise.all(plans.map(async (plan) => {
    const [m, y] = await Promise.all([priceFor(plan, 'month'), priceFor(plan, 'year')]);
    const product = (await s.prices.retrieve(m)).product as string;
    return { product, prices: [m, y] };
  }));
  const tag = `v3-${products.map((x) => x.prices.join(',')).join(';')}`;
  const configs = await s.billingPortal.configurations.list({ limit: 50, active: true });
  const configuration = configs.data.find((c) => c.metadata?.fatecal === tag)?.id ?? (await s.billingPortal.configurations.create({
    metadata: { fatecal: tag },
    business_profile: { headline: 'FateCal 随身吉历', privacy_policy_url: `${SITE_URL}/privacy`, terms_of_service_url: `${SITE_URL}/terms` },
    features: {
      subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'missing_features', 'unused', 'other'] } },
      subscription_update: { enabled: true, default_allowed_updates: ['price'], proration_behavior: 'create_prorations', products },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email'] },
    },
  })).id;
  const portal = await s.billingPortal.sessions.create({ customer: sub.customerId, return_url: `${SITE_URL}/?billing=portal`, configuration, locale: b.lang === 'zh' ? 'zh' : b.lang === 'es' ? 'es' : 'en' });
  return NextResponse.json({ url: portal.url });
}
