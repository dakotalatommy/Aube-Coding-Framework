# OAuth & Webhooks Registry

Replace {API} with your API base (e.g., https://api.brandvx.io).

## OAuth callbacks
- Google: {API}/oauth/google/callback
- Apple: {API}/oauth/apple/callback
- Square: {API}/oauth/square/callback
- Acuity: {API}/oauth/acuity/callback
- HubSpot: {API}/oauth/hubspot/callback
- Facebook: {API}/oauth/facebook/callback (flagged by VITE_FEATURE_SOCIAL)
- Instagram (Instagram Login): {API}/oauth/instagram/callback
- Shopify: {API}/oauth/shopify/callback

## Webhooks
- Stripe: {API}/billing/webhook
- Instagram: {API}/webhooks/instagram (GET verify with `hub.challenge`, POST events; requires `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` + `META_INSTAGRAM_APP_SECRET`)
- Square: {API}/webhooks/square
- Acuity: {API}/webhooks/acuity

## Instagram (Instagram Login - New API)

**OAuth:**
- Start: `GET /oauth/instagram`
- Callback: `GET /oauth/instagram/callback`
- Redirect URI in Meta Dashboard: `https://api.brandvx.io/oauth/instagram/callback`

**Webhook:**
- URL: `POST /webhooks/instagram`
- Verification: `GET /webhooks/instagram` with `hub.verify_token`
- Webhook URL in Meta Dashboard: `https://api.brandvx.io/webhooks/instagram`
- Verify Token: `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`

**Events:** messages, comments, mentions, live_comments, messaging_postbacks, messaging_reactions, messaging_referrals, messaging_seen

**Environment Variables:**
- `META_INSTAGRAM_APP_ID` - Instagram App ID from Meta Developer Console
- `META_INSTAGRAM_APP_SECRET` - Instagram App Secret
- `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` - Token for webhook verification (e.g., "brandvx_instagram_webhook_2025")

## Console notes
- Ensure app domains and redirect URIs match exactly.
- Use staging credentials for staging; production for prod.
- Instagram uses "Instagram API with Instagram Login" flow (not Facebook Login).
