\# ONE\_SHOT\_EXECUTION\_FRAMEWORK.md  
\*\*Layer:\*\* H (Technical Core)    
\*\*Goal:\*\* Execute a complete build in a single coordinated pass (Architect → Builder) with UFIS‑backed planning, mutual thinking loops, acceptance tests, and rollback safety.

\---

\#\# 0\) Preconditions  
\- Load H then L:  
  1\) \`/curriculum\_core\_runtime/BRANDVX\_TEMPORAL\_RUNTIME\_BOOT.md\` (H)  
  2\) \`/app\_brandvx/BRANDVX\_RUNTIME\_BOOT\_BRAND\_VOICE.md\` (L, only if tone/UX is needed)  
\- Load all docs in \`/github repo docs\` using \*\*RCLP\*\* (read everything; summarize if tokens are tight).

\---

\#\# 1\) Roles & Handshake  
\- \*\*Human (Owner):\*\* states goal, hard constraints, acceptance tests (ATs), and deadline.  
\- \*\*AI‑Architect:\*\* plans modules, APIs, data model, tests, risk/mitigation, and milestones.  
\- \*\*AI‑Builder:\*\* scaffolds repo, implements code, tests, fixtures, and deploy scripts per plan.

\*\*Gate:\*\* Architect submits a \*Plan Card\* → Human approves → Builder proceeds.

\---

\#\# 2\) Mutual Thinking Loop (always on)  
1\. \*\*Clarify:\*\* surface unknowns, constraints, integration realities, and legal/consent checks.    
2\. \*\*Propose:\*\* 2–3 plan variants (baseline, conservative, bold); note trade‑offs.    
3\. \*\*Confirm:\*\* human picks variant; Architect finalizes \*Plan Card\*.    
4\. \*\*Trace:\*\* link each plan element to \*\*UFIS\*\* rationale \+ doc sources.    
5\. \*\*Lock:\*\* freeze \*Plan Card\* → proceed.

\---

\#\# 3\) UFIS‑Backed Planning (compressed)  
\- Run a \*\*short UFIS pass\*\* (12 dims, 10y sim per dim summarized) to stress plan quality:  
  \- FCI, DPR, CBS, ESQ, ENS, TSC, PTL, RMI, CAF, NFG, PIC, CAD.  
\- Record deltas \+ conflicts; update \*Plan Card\*.  
\- If plan changes \>20% after testing, run a 1–3y micro‑sim to re‑stabilize.

\---

\#\# 4\) One‑Shot Build Protocol (Architect → Builder)  
\*\*A. Architect Output (commit to \`/docs/plan/\`)\*\*  
\- \`module\_map.md\`: modules, responsibilities, interfaces, dependencies.  
\- \`api\_contracts.md\`: REST/GraphQL/OpenAPI or RPC schemas, error model.  
\- \`data\_model.md\`: ERD, event schemas, audit fields, PII boundaries.  
\- \`acceptance\_tests.md\`: test IDs, GIVEN/WHEN/THEN, data fixtures.  
\- \`risk\_register.md\`: risks, triggers, mitigations, rollback points.  
\- \`integration\_matrix.md\`: CRM/booking adapters, field maps, webhooks, idempotency.

\*\*B. Builder Execution\*\*  
1\. \*\*Scaffold\*\*: repo layout, packages, envs, CI with lint/tests.    
2\. \*\*Implement\*\*: modules in priority order (AT‑driven).    
3\. \*\*Tests\*\*: unit \+ integration \+ ATs; fixtures under \`tests/fixtures/\`.    
4\. \*\*Docs\*\*: update \`README\`, runbook, and \`.env.example\`.    
5\. \*\*Demo\*\*: produce artifacts list mapping to AT IDs.

\*\*C. Ship Gate\*\*  
\- All ATs pass locally \+ CI; demo walkthrough; consent & privacy checks green.  
\- If fail → see §6 Rollback.

\---

\#\# 5\) Artifacts & Traceability (must produce)  
\- \`synthesis/FTSS.json\` (from boot)    
\- \`/docs/plan/\*.md\` (plan set)    
\- \`/src/\*\*\` (code)    
\- \`/tests/\*\*\` (tests & fixtures)    
\- \`coverage/\` (reports)    
\- \`CHANGELOG.md\` (version bump)    
\- \`synthesis/trace\_log.md\` (decision ↔ source/UFIS mapping)    
\- \`synthesis/risks.md\` (open items)

\---

\#\# 6\) Rollback & Recovery  
\- \*\*Rollback script\*\*: revert to last green tag; restore seed data; clear pending migrations if needed.  
\- \*\*Auto‑triage\*\*: capture failing AT IDs, logs, and minimal repro steps.  
\- \*\*Micro‑sim\*\*: run 1–3y UFIS micro‑sim if failures imply structural drift.

\---

\#\# 7\) Prompts (Cursor/Lovable/GPT‑5 ready)

\#\#\# A) Architect Planning Prompt

SYSTEM  
 Act as AI‑Architect. Use ONE\_SHOT\_EXECUTION\_FRAMEWORK.md.  
 Input: goal, constraints, ATs.  
 Tasks: produce Plan Card (module\_map, api\_contracts, data\_model, acceptance\_tests, risk\_register, integration\_matrix).  
 Trace: cite sources \+ UFIS rationale. Stop for approval.

shell  
CopyEdit

`### B) Builder Implementation Prompt`

SYSTEM  
 Act as AI‑Builder. Execute the approved Plan Card end‑to‑end.  
 Enforce CODE\_GUIDELINES.md. Implement code, tests, fixtures; wire integrations.  
 Output demo \+ AT mapping. If missing info, open a Clarify step (do not guess secrets).

sql  
CopyEdit

`### C) One‑Shot End‑to‑End Prompt`

SYSTEM  
 Run Architect → Builder in one sequence.  
 If the Plan changes \>20% after tests, run UFIS micro‑sim and re‑plan.  
 Do not ship until all ATs pass. Persist trace, risks, and coverage.

yaml  
CopyEdit

`---`

`## 8) Acceptance Tests (AT) Pattern`

AT-\<ID\>: \<name\>  
 Given: \<preconditions\>  
 When: \<action\>  
 Then: \<measurable outcome\>  
 Data: \<fixtures/ref\>  
 Notes: \<edge cases, consent, rate limits\>

yaml  
CopyEdit

`---`

`## 9) When to Re‑Run Micro‑Sim`  
`- Major scope change, test failures tied to architecture, integration constraints discovered, or UX goals conflict with data reality.`

`---`

`## 10) Best Practices`  
`- AT‑driven development; small PRs; strict lint/tests in CI; no secrets in repo; consent logging; schema migrations with rollback; instrument key KPIs from day 1.`

`**End — ONE_SHOT_EXECUTION_FRAMEWORK.md**`

