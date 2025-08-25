# OAuth & Webhooks Registry

Replace {API} with your API base (e.g., https://api.brandvx.io).

## OAuth callbacks
- Google: {API}/oauth/google/callback
- Apple: {API}/oauth/apple/callback
- Square: {API}/oauth/square/callback
- Acuity: {API}/oauth/acuity/callback
- HubSpot: {API}/oauth/hubspot/callback
- Facebook: {API}/oauth/facebook/callback (flagged by VITE_FEATURE_SOCIAL)
- Instagram: {API}/oauth/instagram/callback (flagged by VITE_FEATURE_SOCIAL)
- Shopify: {API}/oauth/shopify/callback

## Webhooks
- Stripe: {API}/billing/webhook

## Console notes
- Ensure app domains and redirect URIs match exactly.
- Use staging credentials for staging; production for prod.

