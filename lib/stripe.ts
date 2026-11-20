import Stripe from 'stripe';
import { PRICES, type Interval, type Plan } from './plans';
import type { Sub } from './billing';

export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;
let client: Stripe | null = null;
export function stripe() {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

const NAMES: Record<Exclude<Plan, 'free'>, string> = { basic: 'FateCal Basic', premium: 'FateCal Premium' };

// Find the price for a plan by its lookup key, creating the product and price the first time.
export async function priceFor(plan: Exclude<Plan, 'free'>, interval: Interval): Promise<string> {
  const p = PRICES[plan][interval];
  const s = stripe();
  const found = await s.prices.list({ lookup_keys: [p.lookup], active: true, limit: 1 });
  if (found.data[0]) return found.data[0].id;
  const products = await s.products.search({ query: `metadata['fatecal_plan']:'${plan}'` }).catch(() => ({ data: [] as Stripe.Product[] }));
  const product = products.data[0] ?? await s.products.create({ name: NAMES[plan], metadata: { fatecal_plan: plan }, statement_descriptor: 'FATECAL' });
  const price = await s.prices.create({ product: product.id, unit_amount: p.cents, currency: 'usd', recurring: { interval }, lookup_key: p.lookup, transfer_lookup_key: true, metadata: { fatecal_plan: plan, interval } });
  return price.id;
}

const planOfPrice = (price: Stripe.Price | null | undefined): { plan: Plan; interval?: Interval } => {
  for (const plan of ['basic', 'premium'] as const) for (const interval of ['month', 'year'] as const) {
    if (price?.lookup_key === PRICES[plan][interval].lookup) return { plan, interval };
  }
  const m = price?.metadata?.fatecal_plan;
  return { plan: m === 'basic' || m === 'premium' ? m : 'free', interval: (price?.recurring?.interval as Interval) ?? undefined };
};

// Turn a Stripe subscription into our small record.
export function subFromStripe(s: Stripe.Subscription, prev: Sub): Sub {
  const item = s.items.data[0];
  const { plan, interval } = planOfPrice(item?.price);
  const end = (item as any)?.current_period_end ?? (s as any).current_period_end;
  return {
    ...prev, plan, interval, status: s.status, customerId: typeof s.customer === 'string' ? s.customer : s.customer.id, subId: s.id,
    periodEnd: end ? new Date(end * 1000).toISOString() : undefined,
    trialEnd: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : undefined,
    cancelAtPeriodEnd: s.cancel_at_period_end, trialUsed: prev.trialUsed || !!s.trial_end, updatedAt: new Date().toISOString(),
  };
}
