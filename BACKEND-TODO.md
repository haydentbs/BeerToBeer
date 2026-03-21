# Backend Work Needed for Tonight/Betting Overhaul

**Date:** 2026-03-21
**Context:** The frontend now has result reporting, dispute voting, and updated bet flows. Most backend mutations already exist — this doc covers what needs checking/updating.

---

## 1. Mutations the Frontend Now Calls

These are all called via `mutateApp(action, payload)` from `lib/client/app-api.ts`. The backend handler is in `lib/server/repository.ts` `mutateAppState()`.

### `proposeResult`
**Frontend sends:**
```json
{ "crewId": "...", "betId": "...", "optionId": "..." }
```
**Who can call:** Bet creator OR challenger (for h2h)
**Expected behavior:**
- Validates caller is creator or challenger
- Sets `status` → `pending_result`, `pending_result_option_id` → optionId, `pending_result_at` → now
- Opens 60-second confirmation window
- Returns updated `AppMutationPayload`

**Status:** ✅ Already implemented in backend (`case 'proposeResult'`)

### `confirmResult`
**Frontend sends:**
```json
{ "crewId": "...", "betId": "..." }
```
**Expected behavior:**
- Checks 60s window has elapsed since `pending_result_at`
- Resolves bet with pari-mutuel math
- Creates ledger entries
- Returns updated payload

**Status:** ✅ Already implemented (`case 'confirmResult'`)

### `disputeResult`
**Frontend sends:**
```json
{ "crewId": "...", "betId": "..." }
```
**Expected behavior:**
- Must be during pending_result 60s window
- Creates dispute record with 60s vote window
- Sets `status` → `disputed`
- Returns updated payload

**Status:** ✅ Already implemented (`case 'disputeResult'`)

### `castDisputeVote`
**Frontend sends:**
```json
{ "crewId": "...", "betId": "...", "optionId": "..." }
```
**⚠️ Note:** Frontend sends `betId`, NOT `disputeId`. The backend's current `castDisputeVote` case expects `disputeId`. Either:
- (a) Backend should look up the active dispute from the betId, OR
- (b) The Bet object returned to the frontend should include `disputeId` so we can send it

**Preferred:** Option (a) — backend resolves disputeId from betId internally.

**Expected behavior:**
- Only wagering members can vote
- One vote per member
- If all members voted, auto-finalize
- Majority wins → resolve bet
- Tie → void bet, return drinks

**Status:** ⚠️ Exists but needs the betId→disputeId lookup (or frontend Bet type needs `disputeId` field)

---

## 2. H2H Bet Timing Change

**What changed:** Frontend no longer sends a `closeTime` for h2h challenges. The create-bet modal hides the timer selector for 1v1s.

**What this means for backend:**
- When `type === 'h2h'`, `closesAt` should be `null` (no wagering window)
- `respondByAt` should still be set (auto ~5 minutes for invite expiry)
- Once accepted, the bet goes to `open` with `closesAt: null` — it stays open until someone reports the result
- The `respondToBetOffer` handler already sets `closesAt` on accept (`closeAfterAcceptMinutes`). For h2h, this should probably NOT set `closesAt` (or set it to null). Check the current behavior.

**Status:** ⚠️ Needs verification — does `respondToBetOffer` set `closesAt` for accepted h2h bets? If so, it should skip that for h2h.

---

## 3. Fields the Frontend Now Reads

These fields on `Bet` should be populated in `buildDomainBet`:

| Field | Used For | Currently Populated? |
|-------|----------|---------------------|
| `pendingResultOptionId` | Showing which option was proposed | ✅ Yes |
| `pendingResultAt` | 60s countdown timer in dispute window | ✅ Yes |
| `challengeWager` | Displaying h2h main match stakes | ✅ Yes |
| `respondByAt` | Invite expiry timer | ✅ Yes |
| `closesAt` | Nullable for h2h (no wagering window) | ⚠️ Check it can be null |

---

## 4. Auto-Confirm / Auto-Expire

The frontend relies on polling (every 4-8s during active nights) to pick up state changes. These should happen server-side:

- **Auto-confirm result:** If 60s passes after `pending_result_at` with no dispute, the bet should auto-resolve on next poll/request. Currently the frontend shows a "Confirm Result" button after 60s, but ideally the backend also auto-resolves.
- **Auto-expire invites:** If `respondByAt` passes with no response, the bet should auto-decline. The frontend filters out declined bets from the settled list.
- **Auto-finalize disputes:** If dispute vote window expires, finalize with current votes.

**Status:** ⚠️ Check if these auto-transitions happen on backend poll, or only when explicitly triggered by a client action.

---

## 5. Summary of Required Changes

| Priority | Change | Effort |
|----------|--------|--------|
| **HIGH** | `castDisputeVote` should accept `betId` (not just `disputeId`) | Small — add lookup |
| **HIGH** | Verify h2h bets can have `closesAt: null` after acceptance | Small — check `respondToBetOffer` |
| **MEDIUM** | Auto-confirm results after 60s (on poll/bootstrap) | Medium |
| **MEDIUM** | Auto-expire invites past `respondByAt` | Medium |
| **LOW** | Auto-finalize disputes after vote window | Medium |
