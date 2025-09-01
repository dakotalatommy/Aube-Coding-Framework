# Connectors E2E Smoke Tests

Tenant: <tenant_id>

1) Square
- Connect via /oauth/square/login → return to Integrations (connected=1)
- POST /oauth/refresh { tenant_id, provider: 'square' } → status ok
- POST /integrations/booking/square/sync-contacts { tenant_id } → imported > 0
- POST /integrations/booking/square/backfill-metrics { tenant_id } → updated ≥ 0
- GET /integrations/status?tenant_id=:id → providers.square.linked true; last_sync > 0
- GET /contacts/list?tenant_id=:id → items populated

2) HubSpot
- Connect (optional) → POST /crm/hubspot/import { tenant_id } → imported ≥ 0

3) Calendar
- POST /calendar/sync { tenant_id, provider: 'google' } → completed
- POST /calendar/merge { tenant_id } → merged ≥ 0 (can be 0)

4) Maintenance & Health
- GET /integrations/rls/selfcheck → status ok
- POST /integrations/connectors/cleanup { tenant_id } → deleted ≥ 0
- POST /integrations/connectors/normalize { tenant_id } → normalized ≥ 0
- GET /integrations/events?tenant_id=:id → recent items include oauth/sync/import/backfill

UI
- Integrations page: badges display; buttons enabled; toasts show success/errors
- Onboarding → Connections: Square connect/import/backfill buttons work; disabled states respected
