export const INBOUND_DOMAIN = 'in.fatecal.com';

export type MailKind = 'meeting' | 'order' | 'travel' | 'bill' | 'contract' | 'verify' | 'other';

// What FateCal keeps about a forwarded email: a short extract, never the full body.
export interface MailItem {
  id: string;
  receivedAt: string;
  from: string;
  subject: string;
  kind: MailKind;
  title: string;
  start?: string; // ISO with offset, or local wall time "YYYY-MM-DDTHH:mm"
  end?: string;
  allDay?: boolean;
  location?: string;
  amount?: string;
  merchant?: string;
  summary: string;
  verifyLink?: string;
  verifyCode?: string;
}
