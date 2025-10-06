import { test, expect } from '@playwright/test';

const TENANT_ENV = 'E2E_TENANT_ID';
const TOKEN_ENV = 'E2E_SERVICE_ROLE_TOKEN';

/**
 * E2E credentials required:
 *  - E2E_TENANT_ID: UUID of the tenant with at least 10 eligible contacts.
 *  - E2E_SERVICE_ROLE_TOKEN: Bearer token with owner_admin access for that tenant.
 * Optional overrides:
 *  - E2E_API_BASE: API origin (defaults to http://localhost:8000).
 *  - E2E_FOLLOWUPS_SCOPE: Segment scope (default "reengage_30d").
 *  - E2E_FOLLOWUPS_TEMPLATE_ID: Template id (default matches scope).
 *  - E2E_FOLLOWUPS_MIN_COUNT: Minimum contacts required before running (default 10).
 *  - E2E_SERVICE_USER_ID: Optional user id applied to X-User-Id header (default "e2e-runner").
 */
test.describe('Follow-up drafting worker', () => {
  test('creates batched follow-up markdown and reports chunk progress', async ({ request }) => {
    const tenantId = process.env[TENANT_ENV];
    const token = process.env[TOKEN_ENV];
    test.skip(!tenantId || !token, `Missing required environment: ${TENANT_ENV}/${TOKEN_ENV}`);

    const apiBase = process.env.E2E_API_BASE?.replace(/\/$/, '') || 'http://localhost:8000';
    const scope = process.env.E2E_FOLLOWUPS_SCOPE || 'reengage_30d';
    const templateId = process.env.E2E_FOLLOWUPS_TEMPLATE_ID || 'reengage_30d';
    const minCount = Number(process.env.E2E_FOLLOWUPS_MIN_COUNT || 10);

    const headers = {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Id': tenantId as string,
      'X-Role': 'owner_admin',
      'X-User-Id': process.env.E2E_SERVICE_USER_ID || 'e2e-runner',
    };

    const candidatesRes = await request.get(`${apiBase}/followups/candidates`, {
      params: { tenant_id: tenantId, scope },
      headers,
    });
    expect(candidatesRes.ok()).toBeTruthy();
    const candidateJson = await candidatesRes.json();
    const candidates = Array.isArray(candidateJson?.items) ? candidateJson.items : [];
    test.skip(candidates.length < minCount, `Segment ${scope} only returned ${candidates.length} contact(s)`);

    const draftRes = await request.post(`${apiBase}/followups/draft_batch`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      data: {
        tenant_id: tenantId,
        scope,
        template_id: templateId,
      },
    });
    expect(draftRes.ok()).toBeTruthy();
    const draftJson = await draftRes.json();
    expect(draftJson.status).toBeDefined();
    expect(Array.isArray(draftJson.job_ids) || draftJson.status === 'ready').toBeTruthy();

    const pollStatus = async () => {
      const statusRes = await request.get(`${apiBase}/followups/draft_status`, {
        params: { tenant_id: tenantId },
        headers,
      });
      expect(statusRes.ok()).toBeTruthy();
      return statusRes.json();
    };

    let latest: any = draftJson;
    if (draftJson.status !== 'ready') {
      await expect.poll(async () => {
        latest = await pollStatus();
        if (latest.status === 'error') {
          throw new Error(`Follow-up draft failed: ${JSON.stringify(latest.details || latest)}`);
        }
        return latest.status;
      }, { timeout: 240_000, message: 'follow-up draft did not complete in time' }).toBe('ready');
    } else {
      latest = draftJson;
    }

    const details = latest.details || {};
    expect(details.draft_status).toBe('ready');
    const chunkTotal = Number(details.chunk_total || 0);
    const chunkDone = Number(details.chunk_done || 0);
    expect(chunkTotal).toBeGreaterThanOrEqual(1);
    expect(chunkDone).toBe(chunkTotal);

    const chunks = Array.isArray(details.chunks) ? details.chunks.filter((entry: unknown) => typeof entry === 'string' && (entry as string).trim().length > 0) : [];
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk).toContain('##');
    }

    const markdown = String(details.draft_markdown || draftJson.draft_markdown || '');
    expect(markdown.length).toBeGreaterThan(50);
    expect(markdown).toContain('##');
  });
});
