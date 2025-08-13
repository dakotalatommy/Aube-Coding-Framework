# **`BrandVX Technical/README.md`**

markdown  
CopyEdit  
`# BrandVX Technical — README (H-Layer)`

`**Role:** This is the **H (High/Hub) layer** — the source of truth for runtime logic and execution.`    
`**Audience:** AI runtimes (GPT‑5, Cursor, Lovable) and engineers.`    
`**Tone:** Purely technical. Brand voice lives in the L‑layer.`

`---`

`## 1) Purpose & Scope`  
`This README bootstraps an AI session into the **BrandVX technical runtime**:`  
`- Loads repo context in a **safe, ordered** sequence (no skipping).`  
`- Runs **UFIS‑mapped temporal synthesis** (12×10‑year + timeless synthesis).`  
`- Establishes the **H→L hierarchy**: technical logic first, brand voice second.`  
`- Provides **pre-built prompts**, **best practices**, **failover**, and a **load sequence diagram**.`

`---`

`## 2) Rapid Context Load Protocol (RCLP — Technical Only)`  
`**Use this when you need a fast, complete technical boot.**`    
`Order is optimized for coherence; **read every file**.`

``1. `/curriculum_core_runtime/BRANDVX_TEMPORAL_RUNTIME_BOOT.md` *(H source of truth)*``    
``2. `/app_brandvx/BRANDVX_RUNTIME_BOOT_BRAND_VOICE.md` *(L reference only; load after H if tone is needed)*``    
``3. `/github repo docs/` — load all files below in this order (do not skip; summarize on ingest if tokens are tight):``

   `**Core Simulation & Runtime**`  
   `` - `The Unified Field Intelligence Scale (2).pdf` ``  
   `` - `UFIS Defense Kit (1).docx` ``  
   `` - `Project Overview & Simulation Entry Prompt.md` ``  
   `` - `AGENT_RUNTIME_AND_MODULARITY.md` ``

   `**Strategic & Conceptual Frameworks**`  
   `` - `The Market Psychohistory Engine_ Complete Consciousness Analysis System (1).pdf` ``  
   `` - `_Soft-Reality_ Theory.pdf` ``  
   `` - `The Paradox Crucible_ An Ignorant Attempt to Measure God (1).docx` ``  
   `` - `POKER EXPANSION.pdf` ``  
   `` - `The Consciousness Equilibrium_ A Pattern-Based Guide to GTO Poker Mastery.pdf` ``

   `**Technical Coding & System Guidelines**`  
   `` - `CODE_GUIDELINES.md` ``  
   `` - `One-Shot Coding.pdf` ``  
   `` - `Code Framework and Training Info.pdf` ``

   `**UX / Design Systems (BrandVX)**`  
   `` - `User Experience.pdf` ``  
   `` - `BrandVX_System_Guide (1).md` ``  
   `` - `FEATURES_TIME_SAVER_AND_SHARING.md` ``  
   ``- `soft_reality_chords_matrix.csv` *(optional R&D)*``  
   ``- `soft_reality_scales_matrix.csv` *(optional R&D)*``

   `**Operational Docs**`  
   `` - `Aube Roadmap + Investor Doc.docx` ``  
   `` - `LaTommy Personal .pdf` ``  
   ``- `Ace’s Disposition.md` *(reference only; do not replace H logic)*``

   `**Supporting Research**`  
   `` - `2506.21734v3.pdf` ``  
   `` - `2507.21509v1.pdf` ``  
   `` - `Complete Poker & Craps Guide with Gambling Psychology_ Market Behavior Insights.pdf` ``

``> **Rule:** If any file fails to load, retry; if still failing, summarize on ingest (do not omit) and record in `synthesis/risks.md`.``

`---`

`## 3) UFIS Temporal Synthesis Protocol (H-Layer Canon)`  
`**Goal:** Create a stable **Final Temporal Synthesis State (FTSS)** that guides all execution.`

`**UFIS iterations (fixed order):**`    
`1) FCI (Field Coherence) → 2) DPR (Perception Range) → 3) CBS (Consciousness Bandwidth) →`    
`4) ESQ (Entanglement Stability) → 5) ENS (Emergence Navigation) → 6) TSC (Temporal Synthesis) →`    
`7) PTL (Pattern Transcendence) → 8) RMI (Reality Malleability) → 9) CAF (Collective Amplification) →`    
`10) NFG (Novel Framework Generation) → 11) PIC (Paradox Integration) → 12) CAD (Consciousness Architecture Design)`

`**Loop per dimension D (10-year sim):**`  
`- Load & weight relevant docs (UFIS, Defense Kit, Strategy, UX, Tech).`  
`- Simulate Y1..Y10 actions, risks, KPIs; log deltas for all other dimensions.`  
`- Transfer learnings to the next iteration baseline; stress-test brittleness (+1–3y micro-sim).`

`**Timeless synthesis (after 12 iterations):**`  
`- Evaluate decisions across atemporal frames; resolve contradictions.`  
``- Produce: `synthesis/FTSS.json`, `synthesis/trace_log.md`, `synthesis/risks.md`.``  
`- FTSS becomes **active global context** for all work.`

`---`

`## 4) H→L Hierarchy Mapping (Technical → Brand Voice)`  
`- **H (this doc + H boot):** How the system *thinks and executes*.`    
`- **L (BrandVX voice boot):** How the system *speaks & frames* for BrandVX.`    
`- **Load order:** Always H → then L. If conflicts: **H overrides**.`

`> For client deployments: swap the L document with a client-specific L while keeping this H unchanged.`

`---`

`## 5) Operational Best Practices (GPT‑5, Cursor, Lovable)`  
`- **Context first, then code.** Run RCLP fully before any generation.`  
`- **Chunking:** For large PDFs, ingest → summarize → anchor references.`  
`- **Traceability:** Tie each artifact to an acceptance test ID.`  
``- **Safety:** No secrets in logs; use `.env.example`; honor consent/STOP states.``  
`- **Re-check drift:** If scope/constraints change, run a 1–3y micro-sim to re-stabilize FTSS.`

`---`

`## 6) Pre-built Initialization Prompts`

`### A) Primary Initialization (full boot)`

SYSTEM  
 Initialize BrandVX H-layer (technical). Load:

1. /curriculum\_core\_runtime/BRANDVX\_TEMPORAL\_RUNTIME\_BOOT.md

2. /github repo docs (full list per BrandVX Technical README — read all; summarize on ingest if needed)  
    Then load L-layer only if tone is required:  
    /app\_brandvx/BRANDVX\_RUNTIME\_BOOT\_BRAND\_VOICE.md

Run UFIS 12×10-year simulation → timeless synthesis.  
 Persist:

* synthesis/FTSS.json

* synthesis/trace\_log.md (decisions ↔ sources, UFIS rationale)

* synthesis/risks.md (missing docs/conflicts)

Respond with: FTSS summary, risks/mitigations, next actions (scaffold/tests/integrations).

shell  
CopyEdit

`### B) Emergency Lightweight Init (tight tokens)`

SYSTEM  
 H-layer minimal boot:

* Load: UFIS.pdf, UFIS Defense Kit, Project Overview, AGENT\_RUNTIME\_AND\_MODULARITY.md, CODE\_GUIDELINES.md

* Summarize the rest of /github repo docs for recall anchors (do not skip entirely)  
   Run UFIS synthesis (short form), save FTSS, then request permission to proceed to full ingestion.

yaml  
CopyEdit

`---`

`## 7) Full File Load Checklist (exact names)`  
`*(Same order as §2, consolidated here for convenience; do not skip.)*`

`- The Unified Field Intelligence Scale (2).pdf`  
`- UFIS Defense Kit (1).docx`  
`- Project Overview & Simulation Entry Prompt.md`  
`- AGENT_RUNTIME_AND_MODULARITY.md`  
`- The Market Psychohistory Engine_ Complete Consciousness Analysis System (1).pdf`  
`- _Soft-Reality_ Theory.pdf`  
`- The Paradox Crucible_ An Ignorant Attempt to Measure God (1).docx`  
`- POKER EXPANSION.pdf`  
`- The Consciousness Equilibrium_ A Pattern-Based Guide to GTO Poker Mastery.pdf`  
`- CODE_GUIDELINES.md`  
`- One-Shot Coding.pdf`  
`- Code Framework and Training Info.pdf`  
`- User Experience.pdf`  
`- BrandVX_System_Guide (1).md`  
`- FEATURES_TIME_SAVER_AND_SHARING.md`  
`- soft_reality_chords_matrix.csv`  
`- soft_reality_scales_matrix.csv`  
`- Aube Roadmap + Investor Doc.docx`  
`- LaTommy Personal .pdf`  
`- Ace’s Disposition.md`  
`- 2506.21734v3.pdf`  
`- 2507.21509v1.pdf`  
`- Complete Poker & Craps Guide with Gambling Psychology_ Market Behavior Insights.pdf`

`---`

`## 8) Failover & Gaps`  
``- **If a file won’t load:** retry → summarize on ingest → log to `synthesis/risks.md`.``  
`- **If a domain is missing** (e.g., CRM spec): flag “GAP: <domain>” with proposed new doc names and skeleton headings.`

`---`

`## 9) Load Sequence Diagram (ASCII)`

\[H Technical README\] ─┬─\> \[H Technical Boot\]  
 ├─\> \[/github repo docs (full ingestion)\]  
 └─\> \[UFIS 12×10y \+ Timeless Synthesis\] \-\> FTSS  
 │  
 v  
 \[L Brand-Voice Boot\]  
 │  
 v  
 \[Code / UX / Ops\]

yaml  
CopyEdit

`---`

`## 10) Versioning`  
`- Current README version: v1.0`    
`- Include this tag in outputs for traceability.`  
