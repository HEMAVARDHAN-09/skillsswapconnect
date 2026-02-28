

## Add Login Retry Mechanism

### Problem
The login form shows "Failed to fetch" errors due to transient network issues, with no automatic recovery.

### Solution
Add an automatic retry mechanism (up to 3 attempts with exponential backoff) to the login form's sign-in logic, so transient network failures are handled gracefully without requiring the user to manually retry.

### Technical Details

**File: `src/pages/Login.tsx`**

1. Create a helper function `retryAsync(fn, maxRetries, baseDelay)` that:
   - Attempts the async function up to 3 times
   - Uses exponential backoff (1s, 2s, 4s delays)
   - Only retries on network errors ("Failed to fetch", "NetworkError", "Network request failed")
   - Throws immediately for auth errors (wrong password, user not found, etc.)

2. Update `handleSubmit` to wrap the `signIn` call with the retry helper

3. Show a toast when retrying so the user knows what's happening (e.g., "Connection issue, retrying...")

No database or backend changes needed -- this is a frontend-only improvement.

