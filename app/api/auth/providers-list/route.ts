import { NextResponse } from 'next/server';
import { providerIds } from '@/auth';

// Which sign-in buttons to show (only providers that are configured).
export function GET() {
  return NextResponse.json({ providers: providerIds });
}
