# Feature Flags

- VITE_FEATURE_SOCIAL=1: Enable Facebook/Instagram connect and social inbox surfaces in Integrations.
- VITE_DISABLE_MOTION=1: Disable 3D/motion-heavy UI for low-power or demo constraints.

Usage
- Checked in operator-ui (Integrations, Hero3D) to gate optional features.
- Prefer off by default in staging; enable when credentials/policy are ready.

