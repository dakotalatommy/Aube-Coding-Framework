\# BrandVX — Master Repository README (Hybrid)

This repo contains the \*\*complete BrandVX AI orchestration system\*\*. It is designed for \*\*direct ingestion\*\* by GPT‑5, Cursor, Lovable, or similar tools, using a deterministic \*\*H→L hierarchy\*\*:  
\- \*\*H (Technical Core)\*\* controls logic, data contracts, tests, safety.  
\- \*\*L (Brand Voice)\*\* controls tone, UX vocabulary, presentation.  
\*\*Rule:\*\* If H and L ever conflict, \*\*H prevails\*\*.

\---

\#\# Folder Map

/  
├─ Boot Instructions/  
│ ├─ README.md  
│ ├─ SYSTEM\_GAP\_CLOSURE.md  
│ ├─ quickstart.md  
│ ├─ H-L\_Hierarchy\_Map.md  
│ └─ RCLP.md  
│  
├─ BrandVX Technical/  
│ ├─ BRANDVX\_DATA\_MODEL\_EVENTS.md  
│ ├─ BRANDVX\_ACCEPTANCE\_TESTS.md  
│ ├─ Technical\_RBAC\_and\_Views.md  
│ ├─ Technical\_Integration\_Specs\_CRM\_and\_Booking.md  
│ ├─ BrandVX Technical\_SUPPLEMENTAL\_CONTEXT\_FRAMEWORK.md  
│ ├─ BrandVX Technical\_ONE\_SHOT\_EXECUTION\_FRAMEWORK.md  
│ ├─ BrandVX Technical README.md  
│ ├─ H-L\_Hierarchy\_Map.md  
│ └─ BRANDVX\_TEMPORAL\_RUNTIME\_BOOT.md  
│  
├─ BrandVX Brand-Voice/  
│ ├─ ONE\_SHOT\_EXECUTION\_GUIDE\_BRAND\_VOICE.md  
│ ├─ FILE\_MAP\_AND\_PURPOSE.md  
│ ├─ BrandVX\_App\_Overview\_\&UX.md  
│ ├─ BrandVX Brand-Voice Boot Instructions README.md  
│ ├─ BRANDVX\_RUNTIME\_BOOT\_BRAND\_VOICE.md  
│ └─ H-L\_Hierarchy\_Map.md  
│  
├─ github\_repo\_docs/  
│ ├─ Ace’s Disposition.md  
│ ├─ Project Overview & Simulation Entry Prompt.md  
│ ├─ The Market Psychohistory Engine Complete Consciousness Analysis System (1).pdf  
│ ├─ User Experience.pdf  
│ ├─ soft\_reality\_chords\_matrix.csv  
│ ├─ soft\_reality\_scales\_matrix.csv  
│ ├─ POKER EXPANSION.pdf  
│ ├─ Quantum Leaps and Neural Evolution Define AI Training in 2025.pdf  
│ ├─ ACE INSTRUCTIONS (1).pdf  
│ ├─ The Consciousness Equilibrium\_ A Pattern-Based Guide to GTO Poker Mastery.pdf  
│ ├─ UFIS Defense Kit (1).docx  
│ ├─ The Paradox Crucible\_ An Ignorant Attempt to Measure God (1).docx  
│ ├─ Soft-Reality Theory.pdf  
│ └─ The Unified Field Intelligence Scale (2).pdf  
│  
├─ Bootstrap Prompt \# (optional: a place to store latest init prompt)  
└─ Master Repo README.md \# (this file)

markdown  
Copy  
Edit

\> PDFs and CSVs are \*\*first-class context\*\*. The AI must read them (summarize if tokens are tight; do not skip).

\---

\#\# Exact Load Order (deterministic)

\*\*0) Orientation (this file)\*\*  
\- Read \`Master Repo README.md\` fully to learn structure and rules.

\*\*1) Boot Instructions/\*\*  
1\. \`Boot Instructions/README.md\`  
2\. \`Boot Instructions/H-L\_Hierarchy\_Map.md\`  
3\. \`Boot Instructions/RCLP.md\`  
4\. \`Boot Instructions/SYSTEM\_GAP\_CLOSURE.md\`  
5\. \`Boot Instructions/quickstart.md\` (if present)

\*\*2) BrandVX Technical/\*\*  
1\. \`BrandVX Technical/BRANDVX\_TEMPORAL\_RUNTIME\_BOOT.md\`  
2\. \`BrandVX Technical/BrandVX Technical README.md\`  
3\. \`BrandVX Technical/BrandVX Technical\_ONE\_SHOT\_EXECUTION\_FRAMEWORK.md\`  
4\. \`BrandVX Technical/BrandVX Technical\_SUPPLEMENTAL\_CONTEXT\_FRAMEWORK.md\`  
5\. \`BrandVX Technical/BRANDVX\_ACCEPTANCE\_TESTS.md\`  
6\. \`BrandVX Technical/BRANDVX\_DATA\_MODEL\_EVENTS.md\`  
7\. \`BrandVX Technical/Technical\_Integration\_Specs\_CRM\_and\_Booking.md\`  
8\. \`BrandVX Technical/Technical\_RBAC\_and\_Views.md\`  
9\. \`BrandVX Technical/H-L\_Hierarchy\_Map.md\` (reference only)

\*\*3) BrandVX Brand-Voice/\*\*  
1\. \`BrandVX Brand-Voice/BrandVX Brand-Voice Boot Instructions README.md\`  
2\. \`BrandVX Brand-Voice/BRANDVX\_RUNTIME\_BOOT\_BRAND\_VOICE.md\`  
3\. \`BrandVX Brand-Voice/BrandVX\_App\_Overview\_&\_UX.md\`  
4\. \`BrandVX Brand-Voice/ONE\_SHOT\_EXECUTION\_GUIDE\_BRAND\_VOICE.md\`  
5\. \`BrandVX Brand-Voice/FILE\_MAP\_AND\_PURPOSE.md\`  
6\. \`BrandVX Brand-Voice/H-L\_Hierarchy\_Map.md\` (reference only)

\*\*4) github\_repo\_docs/\*\* (load all; summarize on ingest if needed)  
\- \`User Experience.pdf\`  
\- \`Project Overview & Simulation Entry Prompt.md\`  
\- \`Ace’s Disposition.md\` (brand psychology; use excerpts only)  
\- \`The Market Psychohistory Engine\_ Complete Consciousness Analysis System (1).pdf\`  
\- \`\_Soft-Reality\_ Theory.pdf\`  
\- \`ACE INSTRUCTIONS (1).pdf\`  
\- \`Quantum Leaps and Neural Evolution Define AI Training in 2025.pdf\`  
\- \`The Unified Field Intelligence Scale (2).pdf\`  
\- \`UFIS Defense Kit (1).docx\`  
\- \`The Paradox Crucible\_ An Ignorant Attempt to Measure God (1).docx\`  
\- \`The Consciousness Equilibrium\_ A Pattern-Based Guide to GTO Poker Mastery.pdf\`  
\- \`POKER EXPANSION.pdf\`  
\- \`soft\_reality\_chords\_matrix.csv\`, \`soft\_reality\_scales\_matrix.csv\` (optional R\&D)  
\> \*\*Do not skip.\*\* If token pressure occurs, produce a per-file 3–8 line summary and record omissions in \`synthesis/risks.md\`.

\---

\#\# Execution Flow (meta fallback)

If no separate init prompt is provided, an AI should:  
1\. Load all files above in order (H→L→Docs).  
2\. Run UFIS (12 iterations × 10 years each) → Timeless Synthesis.  
3\. Persist:  
   \- \`synthesis/FTSS.json\`  
   \- \`synthesis/trace\_log.md\`  
   \- \`synthesis/risks.md\`  
4\. Generate a one‑week sprint plan mapped to \*\*BRANDVX\_ACCEPTANCE\_TESTS.md\*\*.  
5\. Scaffold: backend (Python), web UI, integrations (HubSpot/Acuity), event emitters per \*\*BRANDVX\_DATA\_MODEL\_EVENTS.md\*\*.  
6\. Deliver a “BOOT OK” report (FTSS bullets ≤10, AT readiness, gaps, next actions).

\---

\#\# Determinism, Safety, and H→L Rule

\- \*\*Never\*\* allow brand tone (L) to modify technical constraints (H).  
\- Always enforce tenant scoping, idempotency, privacy redaction, and audit events.  
\- If a file is missing, ask once for the correct path; otherwise summarize from this README’s rules and proceed.

\*\*End — Master Repo README.md\*\*  
