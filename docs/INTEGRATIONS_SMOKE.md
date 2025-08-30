# Integrations Smoke Tests (Browser Console)

Run after logging into https://app.brandvx.io. These snippets verify auth, connected accounts, preflight, and Square sync.

## 1) Resolve token and tenant

```js
(() => {
  const key = Object.keys(localStorage).find(s=>s.includes('sb-')&&s.endsWith('-auth-token'));
  const token = key ? JSON.parse(localStorage.getItem(key)||'{}')?.access_token : null;
  if (!token) return console.warn('No token. Sign in first.');
  const H = { 'Content-Type':'application/json', Authorization:`Bearer ${token}` };
  fetch('https://api.brandvx.io/me', { headers:H }).then(r=>r.json()).then(console.log);
})();
```

## 2) Connected accounts and analyze

```js
(() => {
  const k = Object.keys(localStorage).find(s=>s.includes('sb-')&&s.endsWith('-auth-token'));
  const token = k ? JSON.parse(localStorage.getItem(k)||'{}')?.access_token : null;
  if (!token) return console.warn('No token');
  const H = { 'Content-Type':'application/json', Authorization:`Bearer ${token}` };
  fetch('https://api.brandvx.io/me', { headers:H }).then(r=>r.json()).then(({tenant_id}) =>
    Promise.all([
      fetch(`https://api.brandvx.io/integrations/connected-accounts?tenant_id=${tenant_id}`, { headers:H }).then(r=>r.json()),
      fetch('https://api.brandvx.io/onboarding/analyze', { method:'POST', headers:H, body:JSON.stringify({ tenant_id }) }).then(r=>r.json())
    ])
  ).then(([ca, an])=>{ console.log('connected-accounts', ca); console.log('analyze', an); });
})();
```

## 3) Preflight and CORS

```js
fetch('https://api.brandvx.io/integrations/preflight', { headers:{ Authorization:`Bearer ${JSON.parse(localStorage.getItem(Object.keys(localStorage).find(s=>s.includes('sb-')&&s.endsWith('-auth-token')))||'{}')?.access_token}` } }).then(r=>r.json()).then(console.log);
fetch('https://api.brandvx.io/debug/cors').then(r=>r.json()).then(console.log);
```

## 4) Square import (after connecting)

```js
(() => {
  const k = Object.keys(localStorage).find(s=>s.includes('sb-')&&s.endsWith('-auth-token'));
  const token = k ? JSON.parse(localStorage.getItem(k)||'{}')?.access_token : null;
  if (!token) return console.warn('No token');
  const H = { 'Content-Type':'application/json', Authorization:`Bearer ${token}` };
  fetch('https://api.brandvx.io/me', { headers:H }).then(r=>r.json()).then(({tenant_id}) =>
    fetch('https://api.brandvx.io/integrations/booking/square/sync-contacts', { method:'POST', headers:H, body:JSON.stringify({ tenant_id }) })
  ).then(r=>r.json()).then(console.log);
})();
```


