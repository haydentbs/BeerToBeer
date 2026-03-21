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
**Expected behavior:**
- Only wagering members can vote
- One vote per member
- If all members voted, auto-finalize
- Majority wins → resolve bet
- Tie → void bet, return drinks

**Status:** ✅ Backend now resolves the open dispute from `betId`

---

## 2. H2H Bet Timing Change

**What changed:** Frontend no longer sends a `closeTime` for h2h challenges. The create-bet modal hides the timer selector for 1v1s and omits the field from the payload.

**What this means for backend:**
- When `type === 'h2h'`, `closesAt` should be `null` (no wagering window)
- `respondByAt` should still be set (auto ~5 minutes for invite expiry)
- Once accepted, the bet goes to `open` with `closesAt: null` — it stays open until someone reports the result
- The `respondToBetOffer` handler should leave `closesAt` as `null` for accepted h2h bets.

**Status:** ✅ Accepted h2h bets stay open with `closesAt: null`

---

## 3. Fields the Frontend Now Reads

These fields on `Bet` should be populated in `buildDomainBet`:

| Field | Used For | Currently Populated? |
|-------|----------|---------------------|
| `pendingResultOptionId` | Showing which option was proposed | ✅ Yes |
| `pendingResultAt` | 60s countdown timer in dispute window | ✅ Yes |
| `challengeWager` | Displaying h2h main match stakes | ✅ Yes |
| `respondByAt` | Invite expiry timer | ✅ Yes |
| `closesAt` | Nullable for h2h (no wagering window) | ✅ Yes |

---

## 4. Auto-Confirm / Auto-Expire

The frontend relies on polling (every 4-8s during active nights) to pick up state changes. These should happen server-side:

- **Auto-confirm result:** If 60s passes after `pending_result_at` with no dispute, the bet should auto-resolve on next poll/request. Currently the frontend shows a "Confirm Result" button after 60s, but ideally the backend also auto-resolves.
- **Auto-expire invites:** If `respondByAt` passes with no response, the bet should auto-decline. The frontend filters out declined bets from the settled list.
- **Auto-finalize disputes:** If dispute vote window expires, finalize with current votes.

**Status:** ✅ Implemented on backend poll/bootstrap

---

## 5. Summary of Required Changes

| Priority | Change | Effort |
|----------|--------|--------|
| **DONE** | `castDisputeVote` accepts `betId` and resolves the dispute internally | Completed |
| **DONE** | Accepted h2h bets keep `closesAt: null` | Completed |
| **DONE** | Auto-confirm results after 60s (on poll/bootstrap) | Completed |
| **DONE** | Auto-expire invites past `respondByAt` as declined invites | Completed |
| **DONE** | Auto-finalize disputes after vote window | Completed |
