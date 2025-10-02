# COMPREHENSIVE BOOTSTRAP FLOW ANALYSIS

## Current Symptoms
- User sees `[bvx:auth] session created` in console
- WHITE SCREEN appears
- NO other console logs appear after that

## Critical Flow Trace

### STEP 1: Page Load (Line 709-744)
```typescript
useEffect(() => {
  // Initial session restoration
  const { data } = await supabase.auth.getSession()
  
  if (!data.session) {
    setIsLoadingSession(false)  // Line 720 ✓
    return
  }
  
  setSession(data.session)  // Line 725 - TRIGGERS RE-RENDER
  await bootstrapSession(data.session)  // Line 728 - BLOCKS HERE
  
  setIsLoadingSession(false)  // Line 730 - NEVER REACHED IF BOOTSTRAP HANGS
  
} catch (error) {
  setIsLoadingSession(false)  // Line 740 - ONLY IF ERROR THROWN
}
```

### STEP 2: Component Re-Renders (Lines 1068-1070)
```typescript
if (isLoadingSession) {
  return null  // ← RETURNS NULL BECAUSE isLoadingSession=true
}
```

**State at this point:**
- `isLoadingSession = true` (still waiting for line 730)
- `session = Session object` (set on line 725)
- Guard returns `null` → WHITE SCREEN

### STEP 3: bootstrapSession Function (Lines 569-707)
```typescript
const bootstrapSession = useCallback(async (activeSession) => {
  try {
    console.info('[bvx:auth] session created')  // ✓ USER SEES THIS
    
    // Line 581: Call /me endpoint
    meResponse = await api.get('/me')  // ← LIKELY HANGING HERE
    console.info('[bvx:auth] /me response')  // ✗ NEVER SEEN
    
    // ... rest of bootstrap
    
    console.info('[bvx:auth] bootstrap completed')  // ✗ NEVER SEEN
    
  } catch (error) {
    console.error('Failed to bootstrap session', error)  // ✗ NOT THROWN
  } finally {
    // Line 702-705: Finally block
    setShowSplash(false)
    setShowSplashGuard(false)
    hasBootedRef.current = true
    // ❌ NOTE: setIsLoadingSession NOT HERE!
  }
})
```

## Root Cause Analysis

### Why Bootstrap is Hanging

**Line 581: `await api.get('/me')`**

The `/me` call has:
- Default timeout: **20 seconds** (api.ts line 87)
- If it times out → throws error → caught by try/catch (line 734)
- But user sees NO error message in console!

**This means:**
1. Either the timeout is NOT triggering (AbortController issue?)
2. OR the request is stuck BEFORE the timeout (network layer?)
3. OR there's a deadlock in the API request flow

### Why setIsLoadingSession(false) Never Runs

Current locations where `setIsLoadingSession(false)` is called:

1. **Line 720** - No session found ✓
2. **Line 730** - After successful bootstrap (NEVER REACHED)
3. **Line 740** - After error in useEffect catch (NOT TRIGGERED)
4. **Line 761** - After SIGNED_IN bootstrap
5. **Line 771** - After SIGNED_OUT  
6. **Line 780** - After token refresh

**The issue:** Lines 730 and 740 are in the **useEffect**, AFTER `await bootstrapSession()`.

But `bootstrapSession` itself doesn't set `isLoadingSession=false` in its finally block!

## The Critical Flaw

```typescript
// In useEffect (Line 728-730):
await bootstrapSession(data.session)  // ← Hangs here
setIsLoadingSession(false)  // ← Never reached

// In bootstrapSession finally (Line 701-706):
finally {
  setShowSplash(false)
  setShowSplashGuard(false)
  hasBootedRef.current = true
  // ❌ setIsLoadingSession(false) NOT HERE!
}
```

**If `bootstrapSession` hangs:**
- The `finally` block DOES run (finally always runs)
- But it doesn't set `isLoadingSession=false`
- Control never returns to line 730
- `isLoadingSession` stays `true` forever
- White screen forever

## Proposed Fix Implications

### Option A: Add setIsLoadingSession(false) to bootstrapSession finally
```typescript
finally {
  setShowSplash(false)
  setShowSplashGuard(false)
  hasBootedRef.current = true
  setIsLoadingSession(false)  // ← ADD THIS
}
```

**Pros:**
- Guarantees `isLoadingSession` is always set to false
- Even if bootstrap hangs/fails, UI recovers
- Centralized location (all bootstrap paths go through finally)

**Cons:**
- Lines 730, 740, 761, 771, 780 become redundant
- May hide the real issue (why is /me hanging?)
- Could show UI before bootstrap completes (race condition returns!)

**Implications:**
- If bootstrap fails, UI would render with no userData
- Guard at line 1068 would need to be removed or changed
- Dashboard would try to load without tenant_id (original problem!)

### Option B: Add timeout to bootstrapSession itself
```typescript
const bootstrapSession = useCallback(async (activeSession) => {
  const timeout = setTimeout(() => {
    console.error('[bvx:auth] Bootstrap timeout!')
    setIsLoadingSession(false)
  }, 10000)  // 10 second max
  
  try {
    // ... bootstrap logic
  } finally {
    clearTimeout(timeout)
    setIsLoadingSession(false)
  }
})
```

**Pros:**
- More explicit timeout control
- Can show error message to user
- Recovers from hangs gracefully

**Cons:**
- More complex
- Duplicate timeout logic with api.ts
- Still need to handle UI with partial bootstrap

## THE REAL QUESTION

**Why is /me hanging and not throwing an error?**

We need to investigate:
1. Check browser network tab - is request stuck in "pending"?
2. Check if request even fires - do you see `[bvx:api] fetch` log?
3. Check if timeout is working - does it error after 20 seconds?
4. Check if there's a CORS or preflight issue blocking the request

## Recommendation

**BEFORE fixing the symptom (white screen), we need to:**

1. **Add more logging** to see WHERE exactly it hangs:
   ```typescript
   console.info('[bvx:auth] About to call /me')
   meResponse = await api.get('/me')
   console.info('[bvx:auth] /me returned')
   ```

2. **Check the network tab** in browser DevTools when white screen occurs

3. **Verify the /me endpoint** is actually reachable and returning data

4. **Consider a fail-safe** that shows UI after a reasonable time (5-10s) even if bootstrap incomplete

**Only after understanding WHY bootstrap hangs should we implement the fix.**

Otherwise we're just masking the problem and may break tenant_id resolution again.
