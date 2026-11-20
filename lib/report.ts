import type { Stats } from './accounts';

const PLAN_ZH: Record<string, string> = { basic: '基础版', premium: '高级版' };
const STATUS_ZH: Record<string, string> = { active: '付费中', trialing: '试用中', past_due: '扣款失败', canceled: '已取消', paused: '暂停' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const PROV: Record<string, string> = { google: 'Google', facebook: 'Facebook', email: '邮箱', phone: '手机' };

// The daily report, as plain text and simple HTML (Chinese, for the operator).
export function renderReport(s: Stats) {
  const [t, y] = s.byDay;
  const week = s.byDay.slice(0, 7).reduce((a, b) => a + b.n, 0);
  const subs = Object.entries(s.subs).map(([k, n]) => { const [p, st] = k.split('/'); return `${PLAN_ZH[p] ?? p}${STATUS_ZH[st] ?? st} ${n}`; }).join('，') || '暂无';
  const gifts = Object.entries(s.gifts).map(([c, g]) => `${c} 已领 ${g.used}/${g.max}`).join('，');
  const who = s.recent.map((r) => `${new Date(r.createdAt).toLocaleString('zh-CN', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · ${PROV[r.provider] ?? r.provider} · ${r.email ?? r.name ?? '（无邮箱）'}`);
  const lines = [
    `FateCal 日报 · ${s.today}（洛杉矶时间）`,
    '',
    `今天新注册：${t.n}　昨天：${y.n}　近 7 天：${week}`,
    `累计账号：${s.accounts}　已填生日资料：${s.profiles}　今天打开过：${s.activeToday}`,
    `订阅：${subs}`,
    `赠送码：${gifts}`,
    '',
    '近 14 天每日新注册：',
    s.byDay.map((d) => `${d.day.slice(5)}  ${'■'.repeat(Math.min(d.n, 40))} ${d.n}`).join('\n'),
    '',
    `今天和昨天的新用户（${s.recent.length}）：`,
    ...(who.length ? who : ['（无）']),
    '',
    '后台：https://fatecal.com/admin',
  ];
  const text = lines.join('\n');
  const html = `<pre style="font-family:ui-monospace,Menlo,monospace;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(text)}</pre>`;
  return { subject: `FateCal 日报 ${s.today}：新注册 ${t.n}，累计 ${s.accounts}`, text, html };
}
