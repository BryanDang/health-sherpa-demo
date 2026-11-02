# Triage Chat: architecture

Sample data. Not medical advice.

## Goal

A chat for uninsured adults (26 to 40) that answers two questions: do I need care, and where should I go and what will it cost. Care levels: emergency, urgent, primary, self-care. The user sees results and an expandable view of the assistant's reasoning.

## Flow

1. The user describes a symptom in the chat.
2. `POST /api/triage-stateful` sends the message, recent exchanges and a memory object to the triage backend. The reply holds reasoning (plan, steps, observations, confidence), the assistant message, updated memory, and emergency flags. The route turns that into a care level, or null while the assistant is still asking questions.
3. If the care level is emergency, urgent or primary, the chat offers a price comparison and asks for a zip code.
4. `POST /api/geocode` turns the zip code into coordinates.
5. `POST /api/pricing` returns nearby facilities with cash and negotiated prices for the service that matches the care level, plus a list of likely procedures.

## Backend seam

`src/lib/backend/` holds three interfaces: triage LLM, geocoding, prices. `mock.ts` is the default and uses `fixtures/`. `live.ts` is the real implementation. `BACKEND_MODE=live` selects it. API keys are read only in the live code.

## Safety rules

- Emergency screening comes first. Red flag phrases route to 911 or the emergency department.
- The care level is withheld while the assistant is still gathering information.
- Request bodies are validated: message length, coordinates, billing code pattern, payment type.

## Where things live

- Triage rules and prompts: `src/lib/decisionTree.ts`, `emergency-criteria.ts`, `triage-prompts.ts`, `self-care-guidance.ts`.
- Memory and state: `stateful-llm-interface.ts`, `conversation-memory.ts`, `checkpoint-system.ts`.
- Privacy: `phi-redaction.ts`, `localstorage-utility.ts`, `advanced-prompt-injection-defense.ts`.
- Edge functions of the earlier backend: `supabase/functions/`. Not tested here.

## Open

- The orchestrator and MCP modules in `src/lib/` and `src/mcp/` are not reachable from the demo UI.
- Merge with the other app: `../../../docs/OVERLAP.md`.
