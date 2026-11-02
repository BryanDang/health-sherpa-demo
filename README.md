# Health Sherpa

Sample data. Not medical advice.

Two health-navigation apps in one repo. `apps/health-sherpa` is a guided flow: upload a health document, get a plain-language summary, patterns, next steps and questions for a clinician (Next.js, five phases, patient and provider views). `apps/triage-chat` is a triage chat: describe a symptom, get a care level (emergency, urgent, primary, self-care), then compare prices at nearby facilities (Next.js). Both run in demo mode with no credentials and no network: model, geocoding and price calls go through a small interface per app, and a mock on invented fixtures is the default. The live implementations sit behind environment variables listed in each `.env.example` and are not tested here.

Status: work in progress.

Merge of the two apps: in progress. `apps/triage-chat` is the base. Overlap is listed in `docs/OVERLAP.md`.

## Run it

Triage chat, http://localhost:3001:

```
cd apps/triage-chat
npm ci
npm run dev
```

Health Sherpa, http://localhost:3000:

```
cd apps/health-sherpa
npm ci
npm run dev
```

Build and tests are in each app's README under "Run it".

## Tests

- `apps/triage-chat`: jest, 83 passed, 278 skipped, 0 failed. 12 suites are skipped with the reason 'feature not built'. They are listed in `apps/triage-chat/tests/SKIPPED.md`.
- `apps/health-sherpa`: Playwright, chromium only, 37 passed, 15 skipped, 0 failed. The 15 skipped specs need a live model and network.

Commands are in each app's README under "Run it".

## Data

No real or scraped price data is in the repo. Prices and facility names in the fixtures are invented. The price source the live code was written against is retired.

## AI use disclosure

I used an AI coding assistant to prepare this repository for presentation: building the demo mode with sample data, dependency updates, security fixes, rewriting documentation and comments, and running the tests. The design and the original code are mine. The history here starts at the cleaned version.
