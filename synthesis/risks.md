# Risks & Omissions (Bootstrap)

- Path mismatches: some docs reference `/curriculum_core_runtime` and `/app_brandvx`; actual repo uses `BrandVX Technical/` and `BrandVX Brand-Voice/`.
  - Minimal fix: update those references in `Boot Instructions/README.md` and related docs to current paths.
- Folder name mismatch: references to `/github_repo_docs/` vs actual `GitHub Repo Docs/`.
  - Minimal fix: normalize references or add a note in README; optionally create aliases.
- Binary docs (PDF/DOCX) not machine-read here; acknowledged by title only.
  - Mitigation: summarize on ingest when run in an environment that supports PDF parsing; keep this log until full summaries exist.
- No auth yet in scaffold; tenant scoping implied but not enforced.
  - Mitigation: implement auth/RBAC middleware next sprint (AT‑001/AT‑002).
- Integrations are stubs; rate-limit/backoff logic not implemented.
  - Mitigation: implement CRM/Booking adapters with idempotency and retries (AT‑003/AT‑004).
- Demo path uses in-memory state; no persistence.
  - Mitigation: add Postgres models and migrations in follow-up.

Logged: 2025‑08‑13
