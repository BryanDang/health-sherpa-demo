# Overlap between the two apps

Base for the merge: `apps/triage-chat`. It is the newer app and already has the backend seam (`src/lib/backend/`), the stateful memory and reasoning shape, and the price lookup.

The merge itself is in progress and not part of this change.

## Duplicated code

- `src/components/ui/`: 19 shadcn-style components exist in both apps under the same file names. Eight differ (alert, badge, card, input, label, scroll-area, tabs, textarea); the other eleven are identical. Keep the triage-chat copies; move the health-sherpa-only ones (`radio-group`, `slider`, `switch`) over.
- `src/hooks/use-toast.ts`: same reducer in both. health-sherpa types it with the toast component; triage-chat uses a looser local type.
- `src/lib/utils.ts`: same `cn` helper.
- `src/lib/backend/`: same shape in both (`types.ts`, `mock.ts`, `live.ts`, `index.ts`, `BACKEND_MODE`). Interfaces differ: health-sherpa has one `ChatBackend`; triage-chat has triage, geocode and prices.
- Tooling config: `postcss.config.mjs`, `tailwind` config, `tsconfig.json`, eslint and prettier setup. Near copies.
- Gemini access: both call `@google/generative-ai` with their own prompt building and fallback text.
- Dependencies: Next.js, React 18, Tailwind, Radix, zustand, zod, lucide-react in both.

## Duplicated features

| Feature | health-sherpa | triage-chat | Keep |
| --- | --- | --- | --- |
| Chat with a model | `/api/chat`, `useChat`, `ChatInterface` | `/api/triage-stateful`, `clean-triage-chat` | triage-chat (memory, reasoning, care level) |
| Conversation memory | zustand slices in `src/store/` | `conversation-memory.ts`, stateful LLM memory object | triage-chat |
| Session export | `SessionExport.tsx` | SBAR style export and import in `clean-triage-chat` | triage-chat |
| Safety disclaimers | prompt text in the chat route | emergency criteria and prompt injection defense in `src/lib/` | triage-chat |
| PHI handling | `PrivacyReportModal.tsx`, redacted sample document | `phi-redaction.ts`, `hipaa-compliance.ts` | triage-chat |
| Model rate limiting | model strategy table in `traced-chat` | `smart-rate-limiter.ts`, `user-rate-limiter.ts` | triage-chat |
| Tracing and monitoring | OpenLLMetry setup in `instrumentation*.ts` | Prometheus and Datadog code (removed in this change) | open |

## Only in health-sherpa

- The five phase flow and its engines (`src/phases/engines/`).
- Document upload and review (`DocumentProcessingZone`, `DocumentReviewModal`).
- Insight and action views, clinician dashboard, provider mode toggle.
- Evaluation battery (`ai-evaluation.ts`, `evaluation-middleware.ts`).

## Only in triage-chat

- Emergency detection and care level classification.
- Facility price lookup (geocoding, sample price fixtures).
- Feature flags, local storage utility, progressive disclosure, reasoning and memory display.

## Merge order

1. Move health-sherpa-only UI components into triage-chat.
2. Port the phase engines behind the triage-chat backend interface.
3. Port document upload and review.
4. Retire the health-sherpa copies of the shared code.

## Older copies folded in

Two older copies were staged under `_to-merge/` for comparison and are now removed. Paths below are relative to those copies. Status is one of: added, duplicate, live-backend-only, open.

### sherpa-old

| Path | Status | Note |
| --- | --- | --- |
| `src/lib/insightUtils.ts` | added | Pure parts kept in `apps/health-sherpa/src/lib/insightUtils.ts`, with `confidenceBand` from the blueprint. Icon and style lookup left behind. Test: `tests/insight-utils.spec.ts`. |
| `docs/blueprint.md` | duplicate | Already in `apps/health-sherpa/docs/blueprint.md`, reworded. |
| `src/ai/flows/*`, `src/ai/genkit.ts`, `src/ai/dev.ts` | live-backend-only | Genkit flows that call a model directly. The demo goes through `src/lib/backend`. |
| `src/lib/pdfGenerator.ts` | open | Needs a PDF library that is not a dependency. Text export exists in `SessionExport.tsx`. |
| `src/components/ConfidenceText.tsx`, `CitationLink.tsx`, `MedicalTooltip.tsx` | open | UI for the confidence bands. Needs popover and tooltip primitives that are not in `apps/health-sherpa/src/components/ui/`. Band logic is added. |
| `src/components/insights/PatientInsightsDisplay.tsx`, `ProviderInsightsDisplay.tsx` | open | Larger views. Would be wired to the new `insightUtils`. |
| `src/components/FloatingUploadTab.tsx`, `DocumentCanvas.tsx`, `src/contexts/DocumentCanvasContext.tsx` | duplicate | Covered by `DocumentProcessingZone.tsx` and `ClinicalCanvasLayout.tsx`. |
| `src/components/PrivacyReviewModal.tsx` | duplicate | Covered by `PrivacyReportModal.tsx` and `DocumentReviewModal.tsx`. |
| `src/components/SuggestedQuestions.tsx` | duplicate | Questions come from the phase engines. |
| `src/hooks/useAppStore.tsx` | duplicate | Replaced by the zustand store and `StoreProvider.tsx`. |
| `src/hooks/use-mobile.tsx` | duplicate | Nothing in the demo reads it. Not added. |
| `src/components/ui/*`, `src/lib/utils.ts`, `src/hooks/use-toast.ts`, `src/lib/types.ts` | duplicate | Same shadcn set and helpers. |
| `src/components/ignore - InsightsDisplay.tsx` | duplicate | Marked ignored in its own name. |
| `apphosting.yaml`, `.modified`, `package.json`, `next.config.ts`, tailwind, tsconfig, postcss, components.json | duplicate | Hosting and build config. Nothing to carry. |

### triage-chat

| Path | Status | Note |
| --- | --- | --- |
| `src/lib/translations/detector.ts` | added | `apps/triage-chat/src/lib/translations/detector.ts`. Browser and localStorage only. Regional tags fold to the base language. Test: `tests/unit/language-detector.test.ts`. |
| `src/lib/translations/types.ts` | added | Cut down to the language types. The text dictionary shape was dropped because no dictionary exists. |
| `docs/test-scenarios.md` | added | Rewritten as `apps/triage-chat/docs/TEST_SCENARIOS.md`, pointed at mock mode. |
| `docs/manual-test-script.md`, `docs/intelligent-mcp-test-script.md` | duplicate | Same flows as the scenarios file, aimed at live services. |
| `docs/STATEFUL_MEMORY_IMPROVEMENTS.md` | open | Describes `providersShown` in conversation memory so price follow-ups reuse the provider list. `conversation-memory.ts` has no such field. Worth adding with a unit test. |
| `docs/ALLWELL_ARCHITECTURE.md`, `docs/HEALTHCARE_AI_DASHBOARD_PRD.md`, `docs/COMPONENT_REGISTRY.md`, `docs/REMAINING_TASKS.md`, `docs/DEVELOPMENT_STANDARDS.md`, `docs/ESLINT_CONFIG.md` | duplicate | Planning notes. `apps/triage-chat/docs/ARCHITECTURE.md` covers the current design. |
| `docs/FEATURE_FLAGS_USAGE.md`, `src/lib/featureFlags.ts` | duplicate | `feature-flag-core.ts`, `feature-flag-ab-testing.ts` and `feature-flag-gradual-rollout.ts` exist. |
| `docs/TURQUOISE_HEALTH_INTEGRATION.md`, `docs/DATA_ANALYSIS_REPORT.md`, `docs/CORTEX_NATURAL_LANGUAGE_FINDINGS.md`, `docs/SNOWFLAKE_NETWORK_POLICY_FIX.md`, `docs/MCP_ERROR_HANDLING_IMPLEMENTATION.md`, `data/turquoise-data-exploration.json` | live-backend-only | Notes and exports from a live warehouse. |
| `docs/structured-response-demo.md`, `src/types/structured-response.ts`, `src/components/StructuredResponse.tsx` | duplicate | `src/types/gemini-response.ts` and the schema converter cover it. |
| `src/lib/emergency-criteria.ts`, `self-care-guidance.ts` | duplicate | Byte-identical to the app. |
| `src/lib/triage-prompts.ts`, `decisionTree.ts`, `turquoise-health-client.ts`, `src/types/triage.ts` | duplicate | The app copies are newer supersets. |
| `src/lib/mcp-error-handler.ts`, `mcp-integration-prompts.ts`, `snowflake-mcp-documentation.ts`, `src/mcp/*` | live-backend-only | Servers and prompts for live Maps, Snowflake and Turquoise calls. |
| `src/lib/supabase/*`, `src/store/realtime-store.ts`, `src/lib/websocket-server.ts`, `websocket-server.js`, `src/hooks/use-websocket.ts`, `src/app/api/socket/route.ts` | live-backend-only | Supabase and websocket plumbing. |
| `src/app/api/snowflake-explore`, `check-services`, `explore-facility-types`, `explore-turquoise`, `maps` | live-backend-only | Probe routes for live services. |
| `src/app/api/geocode`, `pricing`, `triage-stateful` | duplicate | Present in the app, served by `src/lib/backend`. |
| `src/components/dashboard/*`, `SimpleDashboard.tsx`, `src/app/dashboard/page.tsx`, `src/hooks/use-auth.tsx`, `src/contracts/*`, `src/types/contracts.ts` | live-backend-only | Clinician dashboard built on Supabase auth and realtime. No demo-mode shape. |
| `src/components/TriageChat*.tsx`, `EnhancedTriageChat.tsx`, `SimpleTriage.tsx`, `src/app/triage/page.tsx` | duplicate | Older chat variants. `clean-triage-chat.tsx` is current. |
| `tests/emergency-deescalation.test.ts`, `tests/integration/*`, `tests/failure/resilience.test.ts`, `tests/unit/*` (auth, dashboard, monitor, config panel, memory, decision path) | live-backend-only | Written against the removed dashboard contracts or live Supabase. |
| `tests/mcp/*` | live-backend-only | Google Maps MCP tests that need a key. |
| `tests/*.spec.ts` (language dropdown, personality, no-language-component) | open | Browser tests for a language dropdown that the app does not have. Revisit when the detector gets a UI. |
| `tests/fever-detection.spec.ts`, `demo-mcp-integration.spec.ts`, `turquoise-health-*.spec.ts` | duplicate | Present in the app. |
| `tests/e2e/*` and screenshots | live-backend-only | Dashboard flows and captured images. |
| `evaluation/*` | open | Python judge harness for safety, empathy and provider search. Needs a hosted judge model. Scenarios are kept in `TEST_SCENARIOS.md`. |
| `scripts/manual/*` | live-backend-only | Ad hoc probes of a live warehouse. |
| `sql/*`, `supabase/migrations`, `supabase/seed.sql`, `supabase/README.md` | live-backend-only | Warehouse and database setup. Not copied. |
| `supabase/config.toml`, `supabase/.temp/*`, `.env.example`, `.env.local.example`, `.firebaserc`, `firebase.json` | live-backend-only | Project settings and identifiers. Not copied. Deleted with the folder. |
| `GENERATE_TRIAGE_BOT_TOKEN.md`, `NEXT_STEPS_TRIAGE_BOT.md` | live-backend-only | Bot token and warehouse setup notes. Not copied. |
| `package.json`, jest and tsconfig files, eslint and prettier files | duplicate | Tooling already in the app. |
