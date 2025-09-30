# UI V2 Tenant Cleanup Follow-Up Plan

## Goal
Finish the tenant cleanup by fixing the contacts export endpoint and removing remaining manual `getTenant()` usage where the API helper already injects the tenant ID.

## Scope
- `apps/operator-ui/src/v2/components/clients.tsx`
- `apps/operator-ui/src/v2/components/inventory.tsx`
- `apps/operator-ui/src/v2/components/settings.tsx`
- `apps/operator-ui/src/v2/components/askvx.tsx`
- `apps/operator-ui/src/v2/components/brandvzn.tsx`
- Shared helper `apps/operator-ui/src/lib/api.ts` only if needed to support the fixes

## Tasks

### 1. Fix Contacts CSV Export
1. Update V2 `Clients` export to hit the backend’s real endpoint `/exports/contacts` instead of the placeholder `/contacts/export.csv`.
2. Include the `tenant_id` query parameter explicitly (e.g., `...?tenant_id=${encodeURIComponent(await getTenant())}`) so the backend contract is honored even when using `fetch` for binary responses.
3. Keep bearer token handling as-is. Ensure the response is still streamed as a blob and download initiated.
4. Adjust success/error toasts if messaging needs to reflect the new path.

### 2. Remove Redundant `getTenant()` Calls
1. Identify components that still fetch the tenant manually even though they call `api.post`/`api.get` immediately afterward (`inventory.tsx`, `settings.tsx`, `askvx.tsx`, `brandvzn.tsx`, plus any others surfaced by `rg "getTenant" apps/operator-ui/src/v2`).
2. Remove the manual `tenantId` lookup and payload fields when they are only used for API calls the helper already decorates.
3. If an endpoint genuinely needs the tenant in the JSON payload (e.g., structured data expected by backend), keep the field and update the helper to allow opting in, otherwise rely on automatic injection.
4. Delete any now-unused imports or variables; run `npm run lint` if the repo uses ESLint/TSLint so unused warnings are caught.

### 3. Validation
1. Run `npm run build` from `apps/operator-ui` to verify TypeScript + bundler still succeed.
2. Manually trigger contacts export in the UI (or via controlled environment) to ensure CSV downloads without errors.
3. Smoke the flows touched by tenant cleanup (inventory sync, settings save, AskVX request, BrandVZN image edit) to confirm they still reach the backend and authentication holds.

## Deliverables
- Updated source files with redundant tenant lookups removed and export endpoint corrected.
- Build logs showing `npm run build` passing.
- Short validation notes confirming manual export works and other flows are intact.

## Handoff Notes
- Changes should be isolated to the listed components/helpers.
- If additional endpoints require explicit tenant payloads, document them in code comments so future cleanups don’t remove them.
- Keep an eye on tests or Playwright scripts if they hardcode `/contacts/export.csv`; they may need updates.
