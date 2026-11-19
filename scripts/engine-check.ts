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
