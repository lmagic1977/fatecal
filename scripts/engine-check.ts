import assert from 'node:assert';
import { computeChart, scoreMoment, scoreDay, readEvent, categorize, branchRelation, sunSign } from '../lib/engine';

// Pillars cross-checked against lunar-javascript directly: 1977-05-10 08:30 -> 丁巳 乙巳 丁卯 甲辰
const c = computeChart({ year: 1977, month: 5, day: 10, hour: 8, minute: 30 });
assert.deepStrictEqual(c.pillars.map((p) => p.stem + p.branch), ['丁巳', '乙巳', '丁卯', '甲辰']);
assert.equal(c.dayMaster, '丁');
assert.equal(c.dayMasterElement, 'fire');
assert.deepStrictEqual(sunSign(5, 10), { en: 'Taurus', zh: '金牛座' });
assert.deepStrictEqual(sunSign(12, 25), { en: 'Capricorn', zh: '摩羯座' });
assert.deepStrictEqual(sunSign(1, 19), { en: 'Capricorn', zh: '摩羯座' });
assert.equal(branchRelation('子', '午'), 'clash');
assert.equal(branchRelation('子', '丑'), 'harmony');
assert.equal(branchRelation('子', '未'), 'harm');
assert.equal(branchRelation('申', '辰'), 'trine');
assert.equal(categorize('Sign lease with landlord'), 'signing');
assert.equal(categorize('和张总谈合作'), 'meeting');
console.log('chart', c.strong ? 'strong' : 'weak', 'favorable', c.favorable, c.counts);

const d = new Date(2026, 10, 19);
const day = scoreDay(c, d);
console.log('day', day.ganZhi, day.score, day.verdict, day.bestHours, day.reasons.map((r) => r.delta + ' ' + r.en));
for (const h of [9, 13, 15, 17]) {
  const m = scoreMoment(c, new Date(2026, 10, 19, h, 0), 'meeting');
  console.log(h, m.hourGanZhi, m.score, m.verdict);
}
const evs = [
  { id: 'a', title: 'Team standup', start: new Date(2027, 0, 5, 9, 30).toISOString(), end: new Date(2027, 0, 5, 10, 0).toISOString(), source: 'manual' as const },
  { id: 'b', title: 'Partnership talk with Mr. Zhang', start: new Date(2027, 0, 5, 14, 0).toISOString(), end: new Date(2027, 0, 5, 15, 0).toISOString(), source: 'manual' as const },
];
const r = readEvent(c, evs[1], evs);
console.log('event', r.category, r.score, r.verdict, r.alternatives);
for (const a of r.alternatives) assert.ok(a.score >= r.score + 8);
// a full week of scores stays within range
for (let i = 0; i < 60; i++) { const s = scoreDay(c, new Date(2026, 10, 19 + i)); assert.ok(s.score >= 5 && s.score <= 98); }
console.log('engine checks passed');
assert.equal(categorize('明天晚上同房好吗'), 'conception');
assert.equal(categorize('周六约会去哪'), 'romance');
assert.equal(categorize('Grand opening of the store'), 'opening');
assert.equal(categorize('Client call'), 'meeting');
console.log('category checks passed');
// feng shui: standard Gua numbers, annual stars and the Li Chun year boundary
import { kuaOf, annualStars, liChunYear, readHome } from '../lib/fengshui';
assert.equal(kuaOf(1977, 'm').number, 2); assert.equal(kuaOf(1977, 'f').number, 1);
assert.equal(kuaOf(1984, 'm').number, 7); assert.equal(kuaOf(1990, 'f').number, 8);
assert.equal(kuaOf(2000, 'm').number, 9); assert.equal(kuaOf(2000, 'f').number, 6);
assert.deepEqual(annualStars(2026), { C: 1, NW: 2, W: 3, NE: 4, S: 5, N: 6, SW: 7, E: 8, SE: 9 });
assert.equal(annualStars(2027).N, 5); assert.equal(annualStars(2024).C, 3);
assert.equal(liChunYear(new Date(2027, 0, 20)), 2026); assert.equal(liChunYear(new Date(2027, 1, 10)), 2027);
assert.equal(readHome('N', kuaOf(1984, 'm'), ['water'], 2026).match, false); // West-group person, East-group house
console.log('feng shui checks passed');
// forwarding cap: read up to the limit, then one notice, then drop
import { countOne } from '../lib/quota';
{
  let u = { n: 0, warned: false };
  const acts: string[] = [];
  for (let i = 0; i < 5; i++) { const r = countOne(u, 3); u = r.usage; acts.push(r.action); }
  assert.deepEqual(acts, ['read', 'read', 'read', 'notice', 'drop']);
  assert.equal(u.n, 5);
  console.log('mail cap checks passed');
}
