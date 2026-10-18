# Browser verification

These tests run the built app against a strict in-memory HTTP substitute for Supabase. Each case gets fresh data and an authenticated test session. No production user data or credentials are required. Requests outside the app and intercepted Supabase origin are blocked. Unhandled backend requests and page errors fail the test.

```sh
npx playwright install chromium webkit
npm run test:e2e:typecheck
npm run test:e2e
```

Run a single journey while developing:

```sh
npm run test:e2e -- e2e/intake-journey.spec.ts --project=iphone-13 --workers=2
```

The projects cover Chromium with iPhone 13, iPhone SE and Pixel 7 settings, plus WebKit with iPhone 13 settings. These are browser/device emulations, not physical device tests. Two native touch-injection tests and one safe-area override test require Chromium's CDP interface and are explicitly skipped on WebKit; ordinary swipe tests and all intake journeys still run there. `PLAYWRIGHT_CHROMIUM_PATH` overrides Chromium only. Local runs can restrict worker count for limited memory; CI uses one worker.

## What is covered

| File | User behavior |
| --- | --- |
| `my-stack.spec.ts` | Create, edit, change plan, archive, switch categories, failed save |
| `my-stack-liste.spec.ts` | List view, stock presentation, category/group navigation and swipe actions |
| `bewertungen.spec.ts` | Review creation, overview, public sharing and deletion |
| `store-compliance.spec.ts` | Consent and age gate, reporting/blocking, account deletion |
| `tagebuch.spec.ts` | Diary editing, search/pagination, intake links and analysis |
| `ernaehrung.spec.ts` | Nutrition: barcode entry (Open Food Facts via mocked `food-lookup`), checksum typos, unknown product → own food reused on next scan, frequent foods with last amount, copy yesterday, delete/undo, correcting values, brand search only on demand and offline, hiding calories |
| `intake-journey.spec.ts` | Create plan and stock, confirm on Home, edit without losing strength/solvent/stock, calendar and stock after reload, skip/reopen, undo/reconfirm, failed request, lost response after commit, stock-only retry, double tap, English |
| `training.spec.ts` | Workout tracker: start a routine with previous values, rest timer, records, save; a running workout survives a reload; log an activity |
| `intake-timeline.spec.ts` | A future quantity change preserves the old receipt; local midnight on a DST day preserves the intended calendar day and slot |

Assertions check visible results, submitted contracts, saved intake identities and stock. Fixed clocks prevent tests from aging with the real date. Use `test.use({ now: new Date('...'), language: 'en' })` for another date or English; default language is German and default date is September 28, 2026 in Europe/Berlin.

`MockSupabase.failNextRpc(name, message)` injects one expected server failure. Network failures use scoped Playwright routes. `scripts/mockSupabase.test.ts` checks the substitute's bounded retry, inventory, relation and filter behavior against the contracts used by these journeys.

## CI and evidence limits

The `Gerätetests` workflow runs the complete unit suite, lint, the production TypeScript/build/prerender command, browser TypeScript checks and all browser projects on pushes and manual runs. Unit checks use `npm test -- --maxWorkers=2` to reduce CPU contention in existing timing-sensitive tests without changing their thresholds. Browser failures retain screenshots and traces; CI uploads the HTML report and test results. A failure in an earlier required step stops the job. This workflow alone does not configure Vercel deployment protection.

Service workers are blocked for deterministic HTTP interception. Auth/onboarding are seeded. These tests do not establish real database/RLS guarantees, concurrent database transaction behavior, actual push delivery, offline PWA support, physical iOS behavior or both occurrences of a repeated DST hour. The existing SQL regression scripts cover database contracts separately.
