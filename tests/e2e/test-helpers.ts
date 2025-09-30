/**
 * UI V2 Test Suite - Helper Utilities
 * 
 * Provides utilities to mint Supabase access tokens via service role,
 * make authenticated API requests, and manage tenant context.
 */

import { createClient } from '@supabase/supabase-js';

interface TestConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
  testTenantId?: string;
  testUserEmail?: string;
  testUserPassword?: string;
}

interface TokenCache {
  accessToken: string | null;
  tenantId: string | null;
  userId: string | null;
}

const cache: TokenCache = {
  accessToken: null,
  tenantId: null,
  userId: null,
};

let config: TestConfig;

/**
 * Initialize test configuration
 */
export function initConfig(testConfig: TestConfig) {
  config = testConfig;
}

function getServiceClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get or create a test user and mint an access token using the service role key
 */
export async function getAccessToken(): Promise<{ accessToken: string; tenantId: string; userId: string }> {
  if (cache.accessToken && cache.tenantId && cache.userId) {
    return {
      accessToken: cache.accessToken,
      tenantId: cache.tenantId,
      userId: cache.userId,
    };
  }

  const supabase = getServiceClient();

  let userId: string;
  let accessToken: string;

  // Try to sign in with existing test user if credentials provided
  if (config.testUserEmail && config.testUserPassword) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: config.testUserEmail,
      password: config.testUserPassword,
    });

    if (error) {
      throw new Error(`Failed to sign in test user: ${error.message}`);
    }

    if (!data.session) {
      throw new Error('No session returned from sign-in');
    }

    accessToken = data.session.access_token;
    userId = data.user.id;
  } else {
    // Create a new test user if no credentials provided
    const testEmail = `test-${Date.now()}@brandvx.test`;
    const testPassword = `TestPass${Date.now()}!`;

    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });

    if (error) {
      throw new Error(`Failed to create test user: ${error.message}`);
    }

    userId = data.user.id;

    // Sign in to get access token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInError) {
      throw new Error(`Failed to sign in newly created user: ${signInError.message}`);
    }

    if (!signInData.session) {
      throw new Error('No session returned from sign-in');
    }

    accessToken = signInData.session.access_token;
  }

  // Fetch tenant_id from /me endpoint
  const tenantId = config.testTenantId || await fetchTenantId(accessToken);

  cache.accessToken = accessToken;
  cache.tenantId = tenantId;
  cache.userId = userId;

  return { accessToken, tenantId, userId };
}

/**
 * Fetch tenant ID from the /me endpoint
 */
async function fetchTenantId(accessToken: string): Promise<string> {
  const response = await fetch(`${config.apiBaseUrl}/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch /me: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.tenant_id) {
    throw new Error('No tenant_id found in /me response');
  }

  return data.tenant_id;
}

/**
 * Make an authenticated API request
 */
export async function apiRequest(
  method: string,
  path: string,
  options: {
    body?: any;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    skipAuth?: boolean;
    skipTenant?: boolean;
  } = {}
): Promise<{ status: number; ok: boolean; data: any; headers: Headers }> {
  const { body, query, headers = {}, skipAuth = false, skipTenant = false } = options;

  let url = `${config.apiBaseUrl}${path}`;

  // Add query parameters
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  // Add tenant_id to query if needed and not skipped
  if (!skipTenant && !query?.tenant_id && method === 'GET') {
    const { tenantId } = await getAccessToken();
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}tenant_id=${tenantId}`;
  }

  // Prepare headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add authorization token
  if (!skipAuth) {
    const { accessToken } = await getAccessToken();
    requestHeaders['Authorization'] = `Bearer ${accessToken}`;
  }

  // Prepare request body
  let requestBody: any = undefined;
  if (body) {
    if (!skipTenant && !body.tenant_id && method !== 'GET') {
      const { tenantId } = await getAccessToken();
      requestBody = JSON.stringify({ tenant_id: tenantId, ...body });
    } else {
      requestBody = JSON.stringify(body);
    }
  }

  // Make request
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });

  // Parse response
  let data: any;
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else if (contentType?.includes('text/')) {
    data = await response.text();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
    headers: response.headers,
  };
}

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a test logger
 */
export class TestLogger {
  private testName: string;
  private startTime: number;
  private logs: string[] = [];

  constructor(testName: string) {
    this.testName = testName;
    this.startTime = Date.now();
  }

  log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    console.log(`  ${message}`);
  }

  error(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const errorMessage = error ? `${message}: ${error.message || error}` : message;
    const logMessage = `[${timestamp}] ERROR: ${errorMessage}`;
    this.logs.push(logMessage);
    console.error(`  ❌ ${errorMessage}`);
  }

  success(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] SUCCESS: ${message}`;
    this.logs.push(logMessage);
    console.log(`  ✅ ${message}`);
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  getAllLogs(): string[] {
    return this.logs;
  }
}

/**
 * Base64 encode a small test image (1x1 transparent PNG)
 */
export function getTestImageBase64(): string {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

/**
 * Seed demo contacts for follow-up drafting tests
 */
export async function seedTestContacts(count = 3): Promise<string[]> {
  const insertedIds: string[] = [];
  const supabase = getServiceClient();
  const { tenantId } = await getAccessToken();

  for (let i = 0; i < count; i += 1) {
    const contactId = `test-contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    insertedIds.push(contactId);
    await supabase.from('contacts').insert({
      tenant_id: tenantId,
      contact_id: contactId,
      first_name: `Test${i + 1}`,
      last_name: 'Client',
      display_name: `Test ${i + 1} Client`,
      consent_sms: true,
      consent_email: true,
      last_visit: Math.floor(Date.now() / 1000) - (i + 1) * 86400,
      creation_source: 'e2e_tests',
    });
  }

  return insertedIds;
}

/**
 * Simple delay helper
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clear token cache (useful for testing re-authentication)
 */
export function clearCache() {
  cache.accessToken = null;
  cache.tenantId = null;
  cache.userId = null;
}
