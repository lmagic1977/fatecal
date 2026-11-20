import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { readSub, uidForCustomer, writeSub } from '@/lib/billing';
import { stripe, subFromStripe } from '@/lib/stripe';

export const runtime = 'nodejs';

// Stripe tells us when a subscription starts, renews, changes or ends; we keep the account's plan in step.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const raw = await req.text();
  let ev: Stripe.Event;
  try { ev = stripe().webhooks.constructEvent(raw, req.headers.get('stripe-signature') ?? '', secret); }
  catch { return NextResponse.json({ error: 'bad_signature' }, { status: 400 }); }

  const syncSub = async (s: Stripe.Subscription) => {
    const customerId = typeof s.customer === 'string' ? s.customer : s.customer.id;
    const uid = s.metadata?.fatecal_uid || (await uidForCustomer(customerId));
    if (!uid) return;
    await writeSub(uid, subFromStripe(s, await readSub(uid)));
  };

  switch (ev.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      await syncSub(ev.data.object as Stripe.Subscription);
      break;
    case 'checkout.session.completed': {
      const cs = ev.data.object as Stripe.Checkout.Session;
      if (cs.subscription) await syncSub(await stripe().subscriptions.retrieve(typeof cs.subscription === 'string' ? cs.subscription : cs.subscription.id));
      break;
    }
    case 'invoice.payment_failed':
    case 'invoice.paid': {
      const inv = ev.data.object as any;
      const subId = inv.subscription ?? inv.parent?.subscription_details?.subscription;
      if (subId) await syncSub(await stripe().subscriptions.retrieve(typeof subId === 'string' ? subId : subId.id));
      break;
    }
  }
  return NextResponse.json({ received: true });
}
