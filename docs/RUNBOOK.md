# BrandVX Runbook

## Endpoints (operator)
- Metrics: GET /metrics?tenant_id={t}
- Funnel: GET /funnel/daily?tenant_id={t}&days=30
- Queue: GET /cadences/queue?tenant_id={t}
- Send: POST /messages/send

## Onboarding
- Settings: GET/POST /settings
- Status: GET /onboarding/status
- Complete: POST /onboarding/complete

## Webhooks (booking)
- POST /webhooks/acuity (HMAC SHA256)
- POST /webhooks/square (HMAC SHA256)

## SLOs
- API latency p95 < 300ms
- Webhook ingest < 2min p95
- Cadence tick within 1min of next_action_at

## Canary cohorts
- Limit weekly onboardings; watch error rates and DLQ volume.

## Load check
- python3 scripts/load_check.py (requires server on :8000)

## Env
- See .env.example for required variables.
