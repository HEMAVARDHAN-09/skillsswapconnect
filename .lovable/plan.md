

# Fix: Auto-refresh sessions + logout-on-refresh bug

## Problem 1: Learner page doesn't update when teacher accepts
The Dashboard loads session data once on mount but has no realtime subscription. When the teacher accepts a session, the learner's page doesn't reflect the change until they manually refresh.

**Fix:** Add a Supabase Realtime subscription in `Dashboard.tsx` that listens for changes on the `sessions` table (filtered to the current user). When a change is detected, automatically reload sessions data.

## Problem 2: Page refresh causes logout
There's a race condition in `AuthContext.tsx`. Both `onAuthStateChange` and `getSession` run simultaneously on mount. The `onAuthStateChange` listener can fire with a `null` session before the persisted session is restored from storage. This sets `user` to `null` and `loading` to `false`, which triggers the Dashboard's redirect to `/login` (`if (!user) { navigate("/login"); }`).

**Fix:** Restructure the auth initialization to:
1. Set up `onAuthStateChange` first (but don't set loading to false on initial null events)
2. Use `getSession` as the primary source for the initial session
3. Only set `loading = false` after `getSession` completes, ensuring the persisted session is checked before any redirect logic runs

## Technical Changes

### File: `src/contexts/AuthContext.tsx`
- Add an `initialized` ref to track whether `getSession` has completed
- In `onAuthStateChange`, skip setting loading to false until after initialization
- Only rely on `getSession` to flip `loading` from true to false on first load
- After initialization, `onAuthStateChange` handles all subsequent auth events normally

### File: `src/pages/Dashboard.tsx`
- Add a `useEffect` that subscribes to Supabase Realtime on the `sessions` table
- Filter for changes where `teacher_id` or `learner_id` matches the current user
- On any `INSERT`, `UPDATE`, or `DELETE` event, call `loadSessions()` and `loadChatRooms()` to refresh the relevant data
- Clean up the channel subscription on unmount

These two changes together ensure:
- The learner sees session status updates (accepted, confirmed, etc.) in real time without refreshing
- Refreshing the browser page correctly restores the auth session instead of logging the user out

