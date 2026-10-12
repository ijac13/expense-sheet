# Backend Node.js upgrade (before 2026-10-30)

## Questions

1. **Which version: Node 24 or Node 22?** I recommend **Node 24**. It's supported by Google until 2028-04-30, which gives a year more than Node 22 (warnings start 2027-04-30). Both need the same small change.
   - Your answer:

2. **Also upgrade the `firebase-functions` library from v6 to v7?** The deploy warns it's outdated, and v7 has breaking changes. I recommend **not now**: v6 works on Node 24, and mixing two upgrades makes a problem harder to trace. Do it later as its own task.
   - Your answer:

## Goal

- The backend (the `api` function and the daily subscription logger) keeps deploying after **2026-10-30**, the date Google shuts down Node.js 20. After that date, any backend fix or feature would fail to deploy.
- Nothing you see in the app changes.

## What changes

- `functions/package.json`: `"engines": { "node": "20" }` becomes `"24"`. This one line tells Firebase which runtime to use.
- `@types/node` follows to match (type definitions only, used while building).
- Your Mac gets Node 24 installed alongside the current Node 20, so tests run on the same version as Google. Your default `node` stays as it is.

## Steps

1. Branch, change the version, run all backend tests on Node 24.
2. Deploy to **staging** and check:
   - the app works: add an expense, an income, open Reports and History,
   - the daily logger runs at 01:00 Taipei time. I'll check the SchedulerLog tab the next morning.
3. You check staging, then I merge.
4. **Production:** you run the backend deploy line (it's blocked for me). The website doesn't change, so there's nothing else to deploy.
5. Next morning: confirm production's SchedulerLog shows a clean 01:00 run.

## Timeline

- Today (Oct 12) to Oct 13: staging plus one overnight logger run.
- By Oct 14: production. That leaves two weeks of margin before Oct 30.

## If something goes wrong

- Before Oct 30, switching back is the same one-line change to `"20"` and a redeploy.
- After Oct 30, there's no going back to 20, which is why this ships early.
