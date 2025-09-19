# Workspace Onboarding Flow

This document summarizes the unified onboarding sequence for the operator UI. The flow is controlled by the workspace onboarding orchestrator (`apps/operator-ui/src/onboarding/workspace/orchestrator.ts`) and runs as a single state machine:

1. **welcome** – render the “Welcome to brandVX” modal and wait for the user to click *Start tour*.
2. **tour** – launch the 11-step `workspace_intro` guide with driver.js and wait for `bvx:guide:workspace_intro:done`.
3. **billing** – open the billing modal and wait for the user to select a plan or skip. Forced runs auto-dismiss after a short delay so the flow can continue in QA.
4. **quickstart** – run the three quick-start steps (Vision, Contacts, AskVX plan). In forced mode the controller auto-skips waits so tests never block.
5. **complete** – mark `guide_done` on the server, persist local flags, and expose the workspace.

The orchestrator exposes a dev helper (`window.__onboarding`) when `?debug=1` so QA can inspect phase transitions, force restarts, or reset state.

## Components & Utilities

- `workspace/storage.ts`: helpers for local/session storage and forced resets.
- `workspace/events.ts`: minimal event bus used by the orchestrator.
- `hooks/useWorkspaceOnboardingController.ts`: React hook that wires component callbacks into the orchestrator and optionally exposes dev helpers.
- `components/WorkspaceShell.tsx`: supplies the UI effects (`showWelcome`, `ensureBilling`, `runQuickstart`, etc.) and renders modals based on orchestrator state.

## Forced Mode / QA Harness

Set `VITE_FORCE_ONBOARD_TOUR=1` (or append `?debug=1&force=1` to the workspace URL) to:

- reset local + server flags via `workspaceStorage.forceReset`
- auto-run the entire flow on every reload
- expose `window.__onboarding` with helpers (`state()`, `start(force)`, `reset()`)

When forced, blocking steps auto-skip so you can iterate quickly while still verifying the billing modal and quick-start surfaces.

## Testing Checklist

1. New tenant with no flags → welcome modal → nav tour → billing → quick start → complete.
2. `?debug=1&force=1` → sequence repeats on every reload; HUD shows `phase` transitions.
3. Existing tenant with `guide_done=true` → orchestrator stays idle unless forced; `billing=prompt` query still opens the modal immediately.

