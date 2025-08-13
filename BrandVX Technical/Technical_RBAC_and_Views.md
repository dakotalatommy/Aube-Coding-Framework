\# RBAC\_and\_Views.md  
\*\*Layer:\*\* H (Technical Core)    
\*\*Purpose:\*\* Role-based access control matrix, route guards, and UI surface definitions for Admin vs Practitioner vs Viewer.

\---

\#\# 1\) Roles  
\- \*\*owner\_admin\*\* (Aube/tenant owner): full admin within tenant (or cross-tenant if platform owner).    
\- \*\*practitioner\*\* (user): manage own clients, bookings, insights, limited settings.    
\- \*\*viewer\*\*: read-only access to permitted resources.

\---

\#\# 2\) Permission Matrix (summary)

| Capability / Resource         | owner\_admin | practitioner | viewer |  
|---|:--:|:--:|:--:|  
| View admin KPIs dashboard     | ✅         | ❌          | ❌     |  
| Manage tenant settings        | ✅         | ❌          | ❌     |  
| View Client 360               | ✅         | ✅          | ✅ (scoped) |  
| Edit client notes             | ✅         | ✅          | ❌     |  
| Import bookings               | ✅         | ✅ (own)    | ❌     |  
| CRM sync actions              | ✅         | ❌          | ❌     |  
| Generate share/ambassador     | ✅         | ✅          | ❌     |  
| Export data                   | ✅         | ✅ (own)    | ❌     |  
| Manage users & roles          | ✅         | ❌          | ❌     |

\*All actions scoped by \`tenant\_id\`; practitioners limited to their tenant.\*

\---

\#\# 3\) Route Guards (examples)  
\- \`/admin/\*\` → \`owner\_admin\` only.    
\- \`/app/clients/:id\` → \`owner\_admin\` or \`practitioner\` with same \`tenant\_id\`; \`viewer\` read-only.    
\- \`/integrations/\*\` → \`owner\_admin\` only.    
\- \`/exports/\*\` → role-based; always write \`ConsentLog\` and \`AuditEvent\`.

\---

\#\# 4\) API Guard Middleware (pseudocode)  
\`\`\`ts  
function guard(requiredRole?: Role) {  
  return (req, res, next) \=\> {  
    const { user } \= req.ctx;  
    if (\!user) return res.status(401).end();  
    if (requiredRole && user.role \!== requiredRole) return res.status(403).end();  
    // tenant scoping  
    req.query.tenant\_id \= user.tenant\_id;  
    // redact PII from logs  
    req.logger.setRedaction(\['email','phone'\]);  
    next();  
  };  
}  
5\) Data Visibility  
Admin: all tenant records; cross-tenant only if platform owner context.

Practitioner: only within own tenant.

Viewer: GET only; hidden fields suppressed (e.g., internal notes, tokens).

6\) UI Surfaces (high level)  
Admin Home (/admin/kpis): tiles \= Active Tenants/Users, Bookings 30/60/90, CRM sync health, Data Freshness; drill-downs to tables.

Client 360 (/app/clients/:id): timeline (bookings, CRM, notes), insights panel (explainability on), actions gated by role.

Integrations (/admin/integrations): CRM/booking status, mapping preview, webhook logs, retry controls.

Ambassador (/app/sharing): create links, scope toggles, attribution window.

Settings: role management (admin), practitioner profile (user).

7\) Consent & Audit Requirements  
Any export/share → write ConsentLog \+ AuditEvent with correlation\_id.

Provide watermarking, time-boxed access, and revocation.

8\) Tests (tie to ATs)  
AT‑001 Auth & RBAC

AT‑002 Tenant Isolation

AT‑005 Consent/Audit

AT‑006 KPIs (admin view)

AT‑007 Client 360 (practitioner)

AT‑008 Sharing/Ambassador

9\) Performance & Caching  
All list endpoints paginated; caches keyed by tenant\_id \+ role.

Ensure no cache bleed across tenants or roles.

10\) Security Notes  
CSRF for mutations; session fixation prevention; lockout on brute force; role change audited.

End — RBAC\_and\_Views.md  
