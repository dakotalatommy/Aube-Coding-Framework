# Connectors Runbook

## Common Actions
- Connect: /oauth/{provider}/login → callback persists to connected_accounts_v2
- Refresh: POST /oauth/refresh { tenant_id, provider }
- Import (Square): POST /integrations/booking/square/sync-contacts { tenant_id }
- Backfill (Square): POST /integrations/booking/square/backfill-metrics { tenant_id }
- Calendar: POST /calendar/sync { tenant_id, provider? }, POST /calendar/merge { tenant_id }
- HubSpot Import: POST /crm/hubspot/import { tenant_id }

## Status & Health
- Per‑provider: GET /integrations/status?tenant_id=...
- Events feed: GET /integrations/events?tenant_id=...
- RLS self‑check: GET /integrations/rls/selfcheck

## Maintenance
- Cleanup v2 rows: POST /integrations/connectors/cleanup { tenant_id? }
- Normalize (migrate legacy + dedupe): POST /integrations/connectors/normalize { tenant_id? }

## Notes
- v2 table stores: status, scopes, expires_at, last_sync, last_error
- Square env: SQUARE_ENV + SQUARE_* endpoints; scopes: MERCHANT_PROFILE_READ CUSTOMERS_READ APPOINTMENTS_READ
- Token retries/backoff handled for OAuth exchanges/refresh
