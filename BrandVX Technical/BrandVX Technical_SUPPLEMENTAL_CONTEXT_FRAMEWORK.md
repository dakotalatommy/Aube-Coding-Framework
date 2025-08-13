\# SUPPLEMENTAL\_CONTEXT\_FRAMEWORK.md  
\*\*Layer:\*\* H (Technical Core)    
\*\*Goal:\*\* Provide a compact, structured way to feed “idea/app” context to the runtime so plans and builds are immediately grounded.

\---

\#\# 0\) How to Use  
1\. Fill the \*\*YAML template\*\* (or the JSON schema) with your idea/app specifics.    
2\. Attach it alongside the boots; the Architect consumes it to produce the Plan Card.    
3\. Keep it small but precise; use links to larger docs if needed.

\---

\#\# 1\) Schema (JSON)  
\`\`\`json  
{  
  "$schema": "https://example.com/supplemental\_context.schema.json",  
  "meta": {  
    "name": "string",  
    "version": "string",  
    "owner": "string",  
    "created\_at": "YYYY-MM-DD"  
  },  
  "goals": \["string"\],  
  "non\_goals": \["string"\],  
  "personas": \[  
    {"id":"string","role":"string","needs":\["string"\],"success\_metrics":\["string"\]}  
  \],  
  "kpis": \[{"name":"string","target":"string","cadence":"daily|weekly|monthly"}\],  
  "constraints": {  
    "legal\_compliance": \["HIPAA","GDPR","..."\],  
    "privacy\_notes": "string",  
    "performance\_slo": {"p95\_ms": 300, "uptime\_pct": 99.9},  
    "budget": {"one\_time\_usd": 0, "monthly\_usd": 0}  
  },  
  "integrations": \[  
    {"system":"hubspot|salesforce|pipedrive|acuity|square|vagaro|other",  
     "scope":"read|write|webhook","notes":"string"}  
  \],  
  "env": {"runtime":"python|node|other","db":"postgres|mysql|sqlite|other","cloud":"aws|gcp|azure|local"},  
  "features": \[{"id":"string","title":"string","desc":"string","priority":"P0|P1|P2"}\],  
  "ufis\_weights": {"FCI":0.5,"DPR":0.5,"CBS":0.5,"ESQ":0.5,"ENS":0.5,"TSC":0.5,"PTL":0.5,"RMI":0.5,"CAF":0.5,"NFG":0.5,"PIC":0.5,"CAD":0.5},  
  "acceptance\_tests\_refs": \["AT-001","AT-002"\],  
  "test\_fixtures": \[{"name":"string","seed":"path-or-inline"}\],  
  "risks": \[{"id":"R-1","desc":"string","mitigation":"string"}\],  
  "notes": "string"  
}  
2\) YAML Template (fill this)  
yaml  
Copy  
Edit  
meta:  
  name: "\<project or idea name\>"  
  version: "v0.1"  
  owner: "\<your name/org\>"  
  created\_at: "2025-08-13"

goals:  
  \- "\<primary objective\>"  
non\_goals:  
  \- "\<explicit exclusions\>"

personas:  
  \- id: "owner\_admin"  
    role: "Platform Owner/Admin"  
    needs: \["visibility across tenants", "audit & consent state", "global KPIs"\]  
    success\_metrics: \["accurate dashboards", "low incident rate"\]  
  \- id: "business\_user"  
    role: "Client Practitioner"  
    needs: \["easy booking sync", "client history", "guided insights"\]  
    success\_metrics: \["time saved", "client retention"\]

kpis:  
  \- name: "Active Tenants"  
    target: "≥ 5 in 90 days"  
    cadence: "weekly"

constraints:  
  legal\_compliance: \["GDPR"\]  
  privacy\_notes: "PII never appears in logs; use tokenized IDs"  
  performance\_slo:  
    p95\_ms: 300  
    uptime\_pct: 99.9  
  budget:  
    one\_time\_usd: 0  
    monthly\_usd: 0

integrations:  
  \- system: "hubspot"  
    scope: "read|write|webhook"  
    notes: "primary CRM"  
  \- system: "acuity"  
    scope: "read"  
    notes: "booking import"

env:  
  runtime: "python"  
  db: "postgres"  
  cloud: "aws"

features:  
  \- id: "auth\_roles"  
    title: "Auth & RBAC"  
    desc: "admins vs practitioners vs viewers"  
    priority: "P0"

ufis\_weights:  
  FCI: 0.6  
  DPR: 0.5  
  CBS: 0.5  
  ESQ: 0.6  
  ENS: 0.6  
  TSC: 0.7  
  PTL: 0.4  
  RMI: 0.4  
  CAF: 0.6  
  NFG: 0.5  
  PIC: 0.5  
  CAD: 0.7

acceptance\_tests\_refs:  
  \- "AT-001"  
  \- "AT-002"

test\_fixtures:  
  \- name: "seed\_min"  
    seed: "tests/fixtures/seed\_min.yaml"

risks:  
  \- id: "R-1"  
    desc: "CRM rate limits"  
    mitigation: "backoff \+ idempotency keys"

notes: "Any other relevant context"  
3\) Flow: How This Drives One‑Shot  
Architect reads YAML/JSON → merges into Plan Card (modules/APIs/data/ATs).

Builder implements per Plan Card; ATs reference the context file; KPIs instrumented.

If major drift from constraints/KPIs, re‑run UFIS micro‑sim.

4\) Minimal BrandVX Seed (placeholder only)  
Keep empty until we explicitly fill with BrandVX specifics.

goals: tbd

personas: tbd

kpis: tbd

integrations: tbd

features: tbd

End — SUPPLEMENTAL\_CONTEXT\_FRAMEWORK.md  
