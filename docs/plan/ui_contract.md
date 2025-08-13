# UI Contract (API-driven surfaces)

Purpose
- Provide a stable JSON contract () that a future React/Next.js or native app can consume to render operator/admin surfaces without changing backend code.

Surfaces
- operator_dashboard: Time Saved, Usage Index; actions: import, cadence start, simulate, STOP
- admin_kpis: tenant health tiles
- integrations: notify-list preference helpers
- sharing: share prompt surfacing

Branding/config
-  returns product name and colors; used for white-label or brand-voice overlays.

Notes
- This contract maps to acceptance tests and event taxonomy; keep IDs stable.
- Extend by adding surface/action/widget entries; avoid breaking existing IDs.
