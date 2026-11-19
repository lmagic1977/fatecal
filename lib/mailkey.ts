import { createHmac } from 'node:crypto';

// The forwarding address is derived from a private read key the browser keeps.
// Knowing the address lets someone send mail in, but only the read key can read it back.
export function addressToken(readKey: string) {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) throw new Error('INBOUND_SECRET missing');
  return createHmac('sha256', secret).update(readKey).digest('base64url').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 14);
}
export const validReadKey = (k: unknown): k is string => typeof k === 'string' && /^[A-Za-z0-9-]{20,64}$/.test(k);
export const validToken = (t: string) => /^[a-z0-9]{14}$/.test(t);
