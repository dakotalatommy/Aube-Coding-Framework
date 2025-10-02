# DEEP FLOW ANALYSIS - Bootstrap & Authentication
## The Ideal vs The Reality

---

## PART 1: THE IDEAL DESIGN (How It Should Work)

### Design Goal
**When a user loads the app, we want:**
1. Show nothing (or loading) while figuring out auth state
2. If authenticated → Show workspace with data
3. If not authenticated → Show landing page
4. NEVER show white screen
5. NEVER show workspace without data (tenant_id must be set first)

### Ideal State Machine

```
┌─────────────────────────────────────────────────────────┐
│ INITIAL STATE                                           │
│ - isLoadingSession = true                               │
│ - session = null                                        │
│ - userData = null                                       │
│ - UI: renders nothing (guard at line 1068)             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ STEP 1: Check for existing session                     │
│ - supabase.auth.getSession()                           │
│ - Takes ~100-500ms                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
                    ┌─────┴─────┐
                    │           │
        NO SESSION  │           │  SESSION EXISTS
                    ↓           ↓
    ┌───────────────────┐   ┌───────────────────┐
    │ NO SESSION PATH   │   │ SESSION PATH      │
    │                   │   │                   │
    │ 1. Set session=null│   │ 1. Set session   │
    │ 2. isLoadingSession│   │ 2. Bootstrap     │
    │    = false         │   │ 3. Fetch /me     │
    │ 3. Render landing │   │ 4. Fetch /settings│
    │                   │   │ 5. Set userData   │
    │                   │   │ 6. isLoadingSession│
    │                   │   │    = false        │
    │                   │   │ 7. Render workspace│
    └───────────────────┘   └───────────────────┘
```

### Critical Design Principles

1. **`isLoadingSession` is THE gate**
   - While `true` → Show nothing/loading
   - When `false` → Render based on session state
   
2. **`isLoadingSession` MUST be set to `false` in ALL paths**
   - Success path
   - Error path  
   - Timeout path
   - Cancellation path

3. **Bootstrap MUST complete before workspace renders**
   - tenant_id MUST be set
   - userData MUST be populated
   - Dashboard data can load async AFTER workspace renders

4. **Timeouts MUST be enforced**
   - Bootstrap should never hang forever
   - If it takes >10 seconds, something is wrong
   - Fail gracefully and show error/retry

---

## PART 2: THE ACTUAL IMPLEMENTATION (What's Really Happening)

### Current Code Structure

```typescript
// LINE 709-744: useEffect (runs once on mount)
useEffect(() => {
  (async () => {
    try {
      const { data } = await supabase.auth.getSession()
      
      if (!data.session) {
        setSession(null)
        setIsLoadingSession(false) // ✓ Good
        return
      }
      
      setSession(data.session) // ← TRIGGERS RE-RENDER
      await bootstrapSession(data.session) // ← CAN HANG HERE
      setIsLoadingSession(false) // ← NEVER REACHED IF HANG
      
    } catch (error) {
      setIsLoadingSession(false) // ✓ Good
    }
  })()
}, [])

// LINE 1068-1070: Render guard
if (isLoadingSession) {
  return null // White screen while isLoadingSession=true
}
```

### The Fatal Flaw

**Problem Location: Lines 728-730**
```typescript
await bootstrapSession(data.session) // ← Line 728
if (cancelled) return
setIsLoadingSession(false) // ← Line 730
```

**If `bootstrapSession` hangs:**
- Line 730 never executes
- `isLoadingSession` stays `true` forever
- Guard returns `null` forever
- WHITE SCREEN FOREVER

**Why doesn't the catch block save us?**
- `bootstrapSession` doesn't THROW an error when hanging
- It just... waits... forever...
- No exception = no catch block triggered
- Even though api.ts has a 20s timeout, something is preventing it from working

---

## PART 3: TRACING THE ACTUAL EXECUTION (Your Console Logs)

### What We See

```
[bvx:auth] session created          ← Line 570 in bootstrapSession ✓
[bvx:api] request /me               ← Line 55 in api.ts ✓
[[Prototype]]: Object
```

### What We DON'T See (Should Appear)

```
[bvx:api] fetch https://api.brandvx.io/me    ← Line 97 in api.ts ✗
[bvx:api] ok /me                             ← Line 126 in api.ts ✗
[bvx:auth] /me response                      ← Line 582 in App.tsx ✗
[bvx:auth] tenant_id persisted               ← Line 620 in App.tsx ✗
[bvx:auth] bootstrap completed               ← Line 666 in App.tsx ✗
```

### State Analysis

**At the moment of white screen:**
```javascript
isLoadingSession = true  // ← Still true!
session = Session{...}   // ← Set on line 725
userData = null          // ← Never set
showSplash = false
showSplashGuard = false
```

**Guard evaluation (line 1068):**
```typescript
if (isLoadingSession) {  // true → returns null → WHITE SCREEN
  return null
}
```

---

## PART 4: THE API CALL MYSTERY

### Expected Flow in api.ts

```typescript
// LINE 54-150 in api.ts
async function request(path: string, options) {
  console.info('[bvx:api] request', path)              // ✓ LOGS
  
  const doFetch = async (base: string) => {
    const ctl = new AbortController()
    const timeoutMs = 20000  // 20 second timeout
    const to = setTimeout(() => ctl.abort('timeout'), timeoutMs)
    
    let url = `${base}${path}`
    // Add tenant_id to URL...
    
    console.info('[bvx:api] fetch', url)               // ✗ DOESN'T LOG!
    
    const res = await fetch(url, { signal: ctl.signal })
    
    if (!res.ok) {
      console.warn('[bvx:api] error', res.status)      // ✗ DOESN'T LOG
      throw new Error(...)
    }
    
    const json = await res.json()
    console.info('[bvx:api] ok', path)                 // ✗ DOESN'T LOG
    return json
  }
  
  return await doFetch(API_BASE)
}
```

### The Critical Gap

**We see:** `[bvx:api] request /me` (line 55)
**We DON'T see:** `[bvx:api] fetch https://...` (line 97)

**This means the code is hanging between lines 55-97!**

Specifically, it's hanging during:
- Line 62-66: Getting Supabase session
- Line 69-80: Resolving tenant_id
- Line 82-88: Setting up AbortController/timeout

### Possible Hanging Points

1. **Line 62-66: `await supabase.auth.getSession()`**
   ```typescript
   const session = (await supabase.auth.getSession()).data.session
   ```
   Could hang if Supabase client is stuck

2. **Line 73: `await getTenant()`**
   ```typescript
   tenantId = await getTenant()
   ```
   Could hang if localStorage access is blocked

3. **Line 87: `setTimeout`**
   ```typescript
   const to = window.setTimeout(...)
   ```
   Unlikely, but could be an issue

---

## PART 5: WHY THE TIMEOUT ISN'T WORKING

### The Timeout Logic

```typescript
// LINE 87 in api.ts
const to = window.setTimeout(() => {
  try { 
    ctl.abort('timeout') 
  } catch {}
}, timeoutMs)
```

**This timeout is set INSIDE `doFetch`**

But if the code hangs BEFORE reaching `doFetch` (between lines 55-82), the timeout **never gets set!**

### The Architecture Problem

```typescript
async function request(path, options) {
  console.info('[bvx:api] request', path)  // ← Logs here (line 55)
  
  // Lines 56-80: Sync/async prep work
  const headers = new Headers(...)
  await getSupabaseSession()  // ← COULD HANG HERE
  await getTenant()            // ← OR HERE
  
  const doFetch = async () => {
    // Line 87: Timeout set HERE
    const to = setTimeout(...)  // ← BUT WE NEVER REACH THIS!
    
    const res = await fetch(url, { signal: ctl.signal })
    // ...
  }
  
  return await doFetch(API_BASE)
}
```

**The timeout only protects the `fetch()` call, not the preparation!**

---

## PART 6: WHAT IF WE BUILT THIS FROM SCRATCH?

### Ideal API Request Architecture

```typescript
async function request(path: string, options: RequestInit) {
  // FIRST: Set up timeout for ENTIRE function
  const globalTimeout = setTimeout(() => {
    throw new Error('Request preparation timed out')
  }, 5000) // 5s for prep
  
  try {
    console.info('[bvx:api] request', path)
    
    // Get auth token
    const session = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => 
        setTimeout(() => reject('Auth timeout'), 2000)
      )
    ])
    
    // Get tenant_id
    const tenantId = await Promise.race([
      getTenant(),
      new Promise((_, reject) => 
        setTimeout(() => reject('Tenant timeout'), 1000)
      )
    ])
    
    clearTimeout(globalTimeout)
    
    // NOW set up fetch timeout
    const fetchTimeout = setTimeout(...)
    const res = await fetch(url, { signal: ctl.signal })
    clearTimeout(fetchTimeout)
    
    return res
    
  } catch (error) {
    clearTimeout(globalTimeout)
    throw error
  }
}
```

### Ideal Bootstrap Architecture

```typescript
const bootstrapSession = useCallback(async (activeSession) => {
  // FIRST: Set maximum time for bootstrap
  const maxBootstrapTime = 10000 // 10 seconds MAX
  const bootstrapTimeout = setTimeout(() => {
    console.error('[bvx:auth] Bootstrap timeout!')
    setIsLoadingSession(false) // Force recovery
  }, maxBootstrapTime)
  
  try {
    // Do bootstrap...
    
  } catch (error) {
    // Handle error...
    
  } finally {
    clearTimeout(bootstrapTimeout)
    setIsLoadingSession(false) // ALWAYS set to false
  }
})
```

### Ideal useEffect Architecture

```typescript
useEffect(() => {
  let cancelled = false
  let maxLoadTimeout: NodeJS.Timeout
  
  (async () => {
    // Maximum time for entire initial load
    maxLoadTimeout = setTimeout(() => {
      if (!cancelled) {
        console.error('[v2] Initial load timeout - forcing UI render')
        setIsLoadingSession(false)
        setSession(null)
      }
    }, 15000) // 15 second absolute maximum
    
    try {
      const { data } = await supabase.auth.getSession()
      
      if (!data.session) {
        setIsLoadingSession(false)
        return
      }
      
      setSession(data.session)
      await bootstrapSession(data.session)
      setIsLoadingSession(false)
      
    } catch (error) {
      setIsLoadingSession(false)
    } finally {
      clearTimeout(maxLoadTimeout)
    }
  })()
  
  return () => {
    cancelled = true
    clearTimeout(maxLoadTimeout)
  }
}, [])
```

---

## PART 7: THE CONTRADICTION MATRIX

### Design Intent vs Actual Behavior

| Design Expectation | Current Reality | Contradiction |
|-------------------|-----------------|---------------|
| Bootstrap completes in <5s | Bootstrap hangs forever | No global timeout |
| API timeout after 20s | Prep hangs before timeout set | Timeout scope too narrow |
| isLoadingSession always set to false | Stays true if bootstrap hangs | Not in finally block |
| White screen never shown | White screen when isLoadingSession=true | Guard too aggressive |
| User sees loading or content | User sees nothing | No loading UI |
| Errors are caught and logged | Silent hang with no error | No timeout error thrown |
| Failed bootstrap recovers | Failed bootstrap hangs forever | No recovery mechanism |

---

## PART 8: THE ROOT CAUSE CHAIN

```
1. User loads page
   ↓
2. useEffect runs, calls supabase.auth.getSession()
   ↓
3. Session exists, setSession(data.session) triggers re-render
   ↓
4. Guard sees isLoadingSession=true, returns null (WHITE SCREEN appears)
   ↓
5. await bootstrapSession() starts
   ↓
6. bootstrapSession calls api.get('/me')
   ↓
7. api.ts line 55: console.info('[bvx:api] request /me') ✓
   ↓
8. api.ts line 62: await supabase.auth.getSession() HANGS
   OR
   api.ts line 73: await getTenant() HANGS
   ↓
9. Timeout never set (line 87 never reached)
   ↓
10. No error thrown (just infinite wait)
   ↓
11. catch block never triggered
   ↓
12. Line 730 setIsLoadingSession(false) never reached
   ↓
13. isLoadingSession stays true forever
   ↓
14. WHITE SCREEN STAYS FOREVER
```

---

## PART 9: THE FIX (Architectural)

### Three-Layer Defense

**Layer 1: Global Bootstrap Timeout**
```typescript
// In bootstrapSession finally block
setIsLoadingSession(false) // ALWAYS run
```

**Layer 2: API Request Timeout (Early)**
```typescript
// In api.ts, BEFORE doFetch
const prepTimeout = setTimeout(() => {
  throw new Error('Request preparation timeout')
}, 5000)
```

**Layer 3: Absolute Maximum Load Time**
```typescript
// In useEffect
const absoluteMax = setTimeout(() => {
  setIsLoadingSession(false)
  console.error('Forced recovery from hang')
}, 15000)
```

---

## PART 10: NEXT STEPS (No Changes Yet)

### Immediate Observations Needed

1. **Add logging between lines 55-97 in api.ts**
   - Exactly where does it hang?
   
2. **Check if supabase.auth.getSession() hangs in api.ts**
   - Add timeout wrapper
   
3. **Check if getTenant() hangs**
   - Is localStorage accessible?
   
4. **Verify window.setTimeout works**
   - Is it being called?

### The Definitive Test

Create a minimal reproduction:
```typescript
// Standalone test
async function testApiPrep() {
  console.log('1. Starting...')
  
  const session = await supabase.auth.getSession()
  console.log('2. Got session')
  
  const tenant = await getTenant()
  console.log('3. Got tenant')
  
  const timeout = setTimeout(() => console.log('4. Timeout set'), 1000)
  console.log('5. Done')
}
```

Run this and see which log is the last one before hang.

---

## SUMMARY

**The Core Problem:**
- `isLoadingSession` is the gate
- It's set to `false` AFTER `await bootstrapSession()`
- Bootstrap hangs in api.ts during request preparation
- Hang happens BEFORE timeout is set
- No error thrown = no catch = no recovery
- `isLoadingSession` stays `true` forever
- WHITE SCREEN forever

**The Fix Direction:**
- Move `setIsLoadingSession(false)` into `finally` block
- Add timeout to API request preparation phase
- Add absolute maximum load timeout in useEffect
- Show loading UI instead of blank screen while `isLoadingSession=true`

**But First:**
- Need to know EXACTLY where it hangs (lines 55-97 in api.ts)
- Then implement proper timeout at that specific point

