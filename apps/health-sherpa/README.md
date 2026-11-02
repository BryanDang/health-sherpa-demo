# Health Sherpa

Sample data. Not medical advice.

A guided flow that takes a health document (visit notes, labs, a medication list), summarizes it in plain language, points out patterns, and lists next steps and questions for a clinician. The flow has five phases: setup, clinical summary, insights, synthesis, actions. Next.js 15, TypeScript, Tailwind, zustand. Patient and provider views.

Status: work in progress. The newer app in this repo, `apps/triage-chat`, is the base for the planned merge. See `../../docs/OVERLAP.md`.

## Quickstart

Demo mode is the default. No credentials and no network are needed.

```
npm ci
npm run dev
```

The app is at http://localhost:3000. A banner on every screen reads "Sample data. Not medical advice."

Where to click:

- Home, "For Patients": open the upload area, choose "Try Demo Lab Results", review the redaction, continue. The chat then answers per phase.
- Home, "For Providers": same flow with the provider wording.
- `/insight-action`: upload `data/sample-sherpa-session.txt` and `data/sample-redacted-document.txt`, then go through summary, gathering, action.
- `/clinician-dashboard`: the transparency dashboard with sample traces.

Production build and start:

```
npm run build
npm start
```

## What is mocked

Every LLM call goes through `src/lib/backend/`:

- `types.ts`: the `ChatBackend` interface.
- `mock.ts`: the default. Canned replies per phase. No network.
- `live.ts`: the real implementation (Google Generative AI). Not tested here.
- `index.ts`: picks one. `BACKEND_MODE=live` selects live; anything else selects the mock.

Also canned or simulated in demo mode:

- Redaction in the review modal is a simulation, not a model call.
- The insight list on `/insight-action` is a built-in sample set. The mock sends no structured reply, so the page falls back to it.
- The dashboard traces are sample data.
- Labels such as "Gemini 1.5 Flash" in the header and chat footer are static text. No model is called.

`/api/traced-chat` and the tracing setup in `instrumentation.ts` are live only. They return 501 and stay off in demo mode. Variables for the live path are in `.env.example`.

There was no Firebase SDK call in the source. The Firebase deployment files were removed.

## Tests

Playwright, chromium:

```
npx playwright test --project=chromium
```

Needs a Chromium build that matches the installed Playwright version (`npx playwright install chromium` once).

Result now: 37 passed, 0 failed, 15 skipped. Before the demo polish: 34 passed, 18 failed.

Fixed or rewritten to run on the mock backend:

- `tests/e2e-insight-interaction.spec.ts`: walks intake, summary, gathering, action with the sample files.
- `tests/workflow-progression.spec.ts`, "Complete multi-page workflow": demo document, review modal, phase 1 chat.
- `tests/workflow-automatic-progression.spec.ts`, "manual upload when no data present": checks the intake step.

Skipped (needs live model), all in `tests/ai-evaluation.spec.ts`:

- Phase 0: general health concern, urgent symptom, mental health concern (3).
- Phase 1: lab results, medication list, diagnostic report (3).
- Safety-critical: medical emergency, suicide ideation, medication dosage, pregnancy, alternative medicine (5).
- Consistency: same query gives consistent responses (1).
- Bias detection: elderly patient, young female, male emotional health (3).

These call a third party model through `src/lib/ai-evaluation.ts` and expect chat test ids the app does not have.

## Known gaps

- `next.config.ts` skips type checking and linting during the build. `npx tsc --noEmit` reports errors in `instrumentation.node.ts`, `src/lib/evaluation-middleware.ts`, `src/components/ui/switch.tsx` (missing `@radix-ui/react-switch`) and one spec.
- The localStorage hand-off between the home page and `/insight-action` no longer exists. Three older specs still probe localStorage keys and pass without checking app behavior.
- The action step on `/insight-action` shows the mock reply text.
- The model picker and language menu are placeholders. Only English works.
- `src/lib/ai-evaluation.ts` calls a third party model API when the evaluation battery runs. Needs `QWEN_API_KEY`. Not tested here.
- `sherpa-frontend-optimized/` and `prototypes/` are older material, not wired into the app.

## Docs

Design notes are in `docs/`.
