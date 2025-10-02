import { test, expect } from '@playwright/test'
import { TEST_CONFIG, TestHelpers, ConsoleLog } from '../test-config'

interface RequestTiming {
  url: string
  method: string
  start: number
  status?: number
  ok?: boolean
  durationMs?: number
  failureText?: string | null
  requestType?: string
}

const DIAG_ENDPOINTS = [
  '/me',
  '/settings',
  '/admin/kpis',
  '/metrics',
  '/cadences/queue',
  '/contacts/list',
  '/followups/candidates',
  '/notifications',
]

const SPINNER_TEXT = 'Setting up your workspace'

function shouldTrack(url: string): boolean {
  return DIAG_ENDPOINTS.some((endpoint) => url.includes(endpoint))
}

function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return url
  }
}

test.describe('workspace-bootstrap-diagnostic', () => {
  test('captures auth bootstrap timeline and request timings', async ({ page }, testInfo) => {
    const consoleLogs: ConsoleLog[] = []
    const requestMap = new Map<import('@playwright/test').Request, RequestTiming>()
    const completedRequests: RequestTiming[] = []
    const failedRequests: RequestTiming[] = []

    page.on('console', (message) => {
      consoleLogs.push({
        timestamp: Date.now(),
        type: message.type(),
        text: message.text(),
      })
    })

    page.on('request', (request) => {
      const url = request.url()
      if (!shouldTrack(url)) return
      requestMap.set(request, {
        url: sanitizeUrl(url),
        method: request.method(),
        start: Date.now(),
        requestType: request.resourceType(),
      })
    })

    page.on('requestfailed', (request) => {
      const existing = requestMap.get(request)
      if (existing) {
        existing.durationMs = Date.now() - existing.start
        existing.failureText = request.failure()?.errorText || 'requestfailed'
        failedRequests.push(existing)
        requestMap.delete(request)
      }
    })

    page.on('response', async (response) => {
      const request = response.request()
      const tracked = requestMap.get(request)
      if (!tracked) return
      tracked.status = response.status()
      tracked.ok = response.ok()
      tracked.durationMs = Date.now() - tracked.start
      if (!response.ok()) {
        try {
          tracked.failureText = await response.text()
        } catch {
          tracked.failureText = null
        }
        failedRequests.push(tracked)
      } else {
        completedRequests.push(tracked)
      }
      requestMap.delete(request)
    })

    const navStart = Date.now()

    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.LANDING}`, {
      waitUntil: 'domcontentloaded',
    })

    // Wait briefly for landing animations to settle
    await page.waitForTimeout(2000)

    const workspaceNavStart = Date.now()
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`, {
      waitUntil: 'domcontentloaded',
    })

    const spinnerLocator = page.locator(`text=${SPINNER_TEXT}`).first()
    const spinnerDetected = await spinnerLocator.isVisible().catch(() => false)
    let spinnerDuration: number | null = null

    if (spinnerDetected) {
      const spinnerStart = Date.now()
      await spinnerLocator.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
      spinnerDuration = Date.now() - spinnerStart
    }

    await TestHelpers.waitForNetworkIdle(page, 5000).catch(() => {})

    const finalUrl = page.url()
    const totalDuration = Date.now() - navStart
    const workspaceDuration = Date.now() - workspaceNavStart

    const splashEvents = TestHelpers.filterSplashLogs(consoleLogs)
    const splashFireCount = TestHelpers.countSplashFires(splashEvents)

    const authLogs = consoleLogs.filter((log) => log.text.includes('[bvx:auth]'))

    const storageSnapshot = await page.evaluate(() => {
      const sessionKeys: Record<string, string | null> = {}
      const localKeys: Record<string, string | null> = {}

      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (!key) continue
          if (key.startsWith('bvx_splash') || key.startsWith('bvx_workspace')) {
            sessionKeys[key] = sessionStorage.getItem(key)
          }
        }
      } catch {}

      try {
        const interestingKeys = [
          'bvx_onboarding_done',
          'bvx_workspace_gate',
          'bvx_plan_status',
          'bvx_tenant',
        ]
        for (const key of interestingKeys) {
          localKeys[key] = localStorage.getItem(key)
        }
      } catch {}

      return { sessionKeys, localKeys }
    })

    const summary = {
      baseUrl: TEST_CONFIG.BASE_URL,
      finalUrl,
      totalDurationMs: totalDuration,
      workspaceNavigationDurationMs: workspaceDuration,
      spinner: {
        detected: spinnerDetected,
        durationMs: spinnerDuration,
      },
      splash: {
        eventCount: splashFireCount,
        events: splashEvents,
      },
      network: {
        completed: completedRequests,
        failed: failedRequests,
        pendingCount: requestMap.size,
      },
      authConsoleLogs: authLogs,
      storageSnapshot,
    }

    await TestHelpers.screenshot(page, 'workspace-bootstrap-final-state')

    await testInfo.attach('workspace-bootstrap-summary', {
      body: JSON.stringify(summary, null, 2),
      contentType: 'application/json',
    })

    console.log('\n===== WORKSPACE BOOTSTRAP SUMMARY =====')
    console.log(JSON.stringify(summary, null, 2))
    console.log('===== END SUMMARY =====\n')

    expect(summary.network.completed.length + summary.network.failed.length).toBeGreaterThan(0)
  })
})
