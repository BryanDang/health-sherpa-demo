# Health Sherpa: product requirements

Sample data. Not medical advice.

## Purpose

People get health papers they cannot read and see clinicians without knowing what to ask. The app takes a document, hides personal identifiers, explains it in plain language, and prepares questions for the clinician.

## Users

- Patients.
- Providers: a provider mode shows summaries for clinical decision support.

## Requirements

1. Upload a health document (PDF or image) by drag and drop.
2. Remove personal identifiers (names, dates, phone numbers, record numbers) and show a report of what was removed.
3. Analyse the document with a model and show insights with a confidence colour (green 90 and up, yellow 70 to 89, orange 50 to 69, red under 50) and clickable citations.
4. Chat about the document in plain language.
5. Export a session summary with key insights and questions for the provider.
6. Provider mode toggle.
7. Five phases (0 to 4) that carry memory from one to the next: trust and setup, clinical summary, insights, synthesis, actions.
8. Trust signals across the journey (`data/TRUST_SIGNALS.json`).

## Non-goals

- No diagnosis, no medical advice. The app helps understand and prepare; health choices belong with a clinician.
- No claim of HIPAA compliance. No audit has been done.

## What is built

- Chat route and screens: `src/app/api/chat/route.ts`, `src/components/ChatInterface.tsx`, `src/hooks/useChat.ts`. Model access sits behind `src/lib/backend/`; the mock is the default.
- Document upload and in-browser de-identification: `DocumentUpload.tsx`, `DocumentProcessingZone.tsx`, `DocumentReviewModal.tsx`, `src/store/slices/documentSlice.ts`. Not checked with a real document.
- Privacy report: `PrivacyReportModal.tsx`.
- Phase engines and orchestrator: `src/phases/engines/`. No test covers them.
- State store, six slices: `src/store/slices/`.
- Provider mode and clinician dashboard: `ProviderModeToggle.tsx`, `ClinicianDashboard.tsx`.
- Insight to action prototype: `InsightActionPrototype.tsx`, `src/app/insight-action/page.tsx`.
- Session export as a JSON file: `SessionExport.tsx`. Not a PDF.
- Evaluation battery: `src/lib/ai-evaluation.ts`, `src/lib/evaluation-middleware.ts`, `EvaluationDashboard.tsx`. Calls a third party model API.
- Tracing (live only): `src/lib/healthcare-tracing.ts`, `instrumentation*.ts`, `src/app/api/traced-chat/route.ts`.
- Static prototypes: `prototypes/`, `sherpa-frontend-optimized/`. Not wired into the app.

## Open

1. PDF export of the session summary. Today the export is JSON.
2. TODOs in `SessionManager.tsx` (restore documents and messages) and `healthcare-tracing.ts` (store traces).
3. Front-door design integration: planned components such as the logo, onboarding flow and answer pills do not exist in `src/`.
4. 18 of 52 Playwright specs fail (chromium). 15 are the evaluation battery, which needs a live model and network. One checks the insight flow, two check workflow progression; one of those fails on two `h1` elements on the page.
5. `npm run typecheck` reports errors. The build skips type checking.
6. Merge into `apps/triage-chat`: see `../../../docs/OVERLAP.md`.
