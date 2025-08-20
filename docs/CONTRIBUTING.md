## BrandVX Self‑Organizing Rules

- Always run `python3 scripts/bootstrap.py` before proposing edits.
- Do not merge unless `python3 scripts/self_organize_gate.py` passes (CI-enforced).
- When backend routes/models change, append a short entry to `synthesis/change_journal.md` and add a “Proposed Deltas @ …” block to `docs/plan/plan_card.md`.
- Invariants in `synthesis/invariants.md` are hard constraints.
- Use `python3 scripts/clean_docs.py --apply` to archive unreferenced docs; if references change, update the boot indexes.


