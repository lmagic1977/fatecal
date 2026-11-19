# FateCal

FateCal reads a person's BaZi (Four Pillars) chart and their real schedule, and says when to do what.
Web app first (installable to the home screen); native apps later.

## What's in this version

- **Chart**: Four Pillars from birth date and time (via [lunar-javascript](https://github.com/6tail/lunar-javascript), MIT), Day Master strength, favorable elements, zodiac and sun sign.
- **Today**: a day score with the almanac's good-for / avoid lists, the best two-hour blocks, and a reading for each event with a better time when one exists.
- **Calendar**: events added by hand, or a calendar's iCal link (Google, iCloud, Outlook). Linked calendars are read-only, so FateCal drafts a reschedule note instead of moving them.
- **FateBot**: ask about any day, time or decision. With `ANTHROPIC_API_KEY` set it answers with Claude, grounded only in the rule engine's readings; without a key it answers from the rules directly.
- English and Simplified Chinese.

Profile and events live in the browser's localStorage; there is no database yet.

## How readings work

`lib/engine.ts` holds every rule. The AI never decides a verdict; it explains the engine's output.
A moment starts at 60 and moves with:

| Rule | Effect |
| --- | --- |
| Day stem element is favorable / not | +8 / -6 |
| Day branch vs your day branch: clash, harm, six-harmony, trine | -15, -7, +9, +5 |
| Day branch clashes your year branch (zodiac) | -6 |
| Hour branch vs your day branch: clash, harm, six-harmony, trine | -12, -9, +8, +5 |
| Hour stem favorable | +3 |
| Almanac yi / ji for the activity (day, hour) | +7 / -10, +3 / -5 |
| Day officer: Break / Success, Open | -6 / +4 |

Good ≥ 68, neutral 52–67, bad < 52. Favorable elements use a simplified strength count (month branch weighted double).
**These rules should be reviewed by a BaZi consultant before launch.**

## Develop

```bash
npm install
npm run dev            # http://localhost:3000
npm run test:engine    # engine checks
```

Environment (see `.env.example`): `ANTHROPIC_API_KEY` (optional), `FATECAL_MODEL` (optional).

## Next

Email forwarding inbox (inbound email service → `/api/inbound` → queue → readings), Google Calendar OAuth for two-way changes, accounts and a database, push notifications, feng shui photo reading.
