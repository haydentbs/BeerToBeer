# BeerScore — Bet System Spec v2

Complete specification for all bet types, pari-mutuel logic, user flows, edge cases, and tournament system. Updated with audit findings and implementation decisions.

---

## Part 1: The Pari-Mutuel Engine

All bet types share the same underlying engine. The math is verified and correct across both client and server.

### How It Works

1. A bet has 2+ **options** (possible outcomes)
2. Users place **wagers** (in drinks) on one option
3. All wagers across all options form the **pool**
4. A winning option is declared
5. Losers forfeit their entire stake
6. Winners split the **losing pool** proportionally based on how much they staked

### The Formula

```
winner_net_profit = (winner_stake / total_winning_stake) × total_losing_stake
winner_gross_return = winner_stake + winner_net_profit
loser_gross_return = 0
loser_net_result = -loser_stake
```

**Net results across all participants always sum to zero.** This is the invariant that must never break. Every drink a loser loses goes to a winner. No house edge, no rake.

### Worked Examples

**Example 1: Simple Yes/No**
- Alice bets 1 on Yes, Bob bets 1 on No
- Yes wins
- Alice: +1, Bob: -1
- Zero-sum: 0 ✓

**Example 2: Uneven Yes/No**
- Alice 1 on Yes, Ben 2 on Yes (total Yes: 3)
- Cara 1 on No, Dan 0.5 on No (total No: 1.5)
- Yes wins. Losing pool: 1.5
- Alice profit: (1/3) × 1.5 = 0.5
- Ben profit: (2/3) × 1.5 = 1.0
- Cara: -1.0, Dan: -0.5
- Zero-sum: 0.5 + 1.0 - 1.0 - 0.5 = 0 ✓

**Example 3: Multi-option, sole winner**
- Alice 1 on A, Ben 2.5 on B, Cara 1.5 on C
- B wins. Losing pool: 1 + 1.5 = 2.5
- Ben takes everything: +2.5
- Alice: -1.0, Cara: -1.5
- Zero-sum: 0 ✓

**Example 4: Multi-option, multiple winners**
- Alice 1 on A, Ben 3 on A (total A: 4)
- Cara 2 on B, Dan 1 on C
- A wins. Losing pool: 3
- Alice profit: (1/4) × 3 = 0.75
- Ben profit: (3/4) × 3 = 2.25
- Cara: -2, Dan: -1
- Zero-sum: 0 ✓

### Rounding & Remainder Handling

We track to 0.01 drink precision using cent-scale integers internally (multiply by 100, do integer math, divide back).

**Rule: Floor each winner's profit. Give the full remainder to the largest-stake winner (earliest wager as tiebreaker, then ID).**

This is how the SQL `compute_parimutuel_outcomes` works. The sort order for remainder allocation is: stake DESC, created_at ASC, id ASC. The rank-1 winner gets the entire leftover.

**⚠️ FIX NEEDED:** The client-side `resolveBetWithParimutuel` currently distributes remainder round-robin (1 cent to each winner in order). This must be updated to give the full remainder to the rank-1 winner, matching the SQL. The difference is at most a few cents but the client preview and server result should agree.

### Void Conditions

A bet is **voided** (cancelled, all wagers returned, no one wins or loses) when:

1. **No opposing action** — Fewer than 2 options have wagers. No losing pool to pay from. This includes everyone betting on the same side.
2. **Winning stake is zero** — Nobody bet on the winning option. Can't distribute to nobody.
3. **Losing stake is zero** — The winning side is the only funded side. Nothing to distribute.
4. **Dispute results in a tie vote** — Equal votes, no majority.
5. **Manual void by creator** — Creator can void before resolution if circumstances change.
6. **Night closes with bet still open** — Auto-voids any unresolved bets.

When a bet voids, all wagers are returned. No ledger entries created. It's as if the bet never happened. The UI must show a clear reason for the void.

### Wager Rules

| Rule | Value | Rationale |
|------|-------|-----------|
| Minimum wager | 0.5 drinks | Smallest meaningful bet. Fractions accumulate to full drinks over time. |
| Maximum wager | 5 drinks per bet | Prevents one person dominating a pool or creating absurd debt in a single bet. |
| Increment | 0.5 drinks | Valid amounts: 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5 |
| One wager per person per bet | Yes | Pick one side, no hedging. Switching sides replaces your wager. |
| Creator auto-wagers | Yes | Creating a bet places your initial wager immediately. |
| Wager on closed bet | Blocked | Server checks `closes_at > now()` at write time. |
| Wager on own H2H | Allowed | Both players bet on themselves — that's the point. |

**Validation (must be enforced in all 3 layers):**

Client (`isValidWagerAmount`):
```
- drinks > 0
- drinks <= 5              ← FIX NEEDED: not currently checked
- drinks * 2 is integer    ← (0.5 increments)
```

Server (`placeWager` handler):
```
- isValidHalfDrinkAmount(drinks)
- drinks <= 5              ← FIX NEEDED: not currently checked
- bet.status === 'open'
- bet.closes_at > now
```

SQL (wagers table):
```
- mod(drinks * 10, 5) = 0  ← exists
- drinks <= 5               ← FIX NEEDED: add constraint
```

### Projected Payout Display

**⚠️ FIX NEEDED:** `projectBetPayout` uses `Math.round` but actual resolution uses `Math.floor`. This means the preview can show 1 cent more than the actual payout. Change `projectBetPayout` to use `Math.floor` to match.

The projected payout should be visible before confirming a wager: "If Yes wins, you earn +0.8 🍺". This is already calculable via `projectBetPayout` — make sure it's displayed in the wager confirmation UI for all bet types.

---

## Part 2: Data Model

### Bet Type vs Subtype

**Decision:** `type` stays as `'prop' | 'h2h'` — these are the two fundamentally different bet structures (open pool vs. direct challenge). The `subtype` column distinguishes UI presentation within prop bets.

**⚠️ FIX NEEDED:** The SQL type check currently allows `'prop', 'h2h', 'multi'`. Remove `'multi'` from the type check and add a subtype column instead.

```
type: 'prop' | 'h2h'
subtype: 'yesno' | 'overunder' | 'multi' | null   (null for h2h)
```

The engine doesn't care about subtype — it's all pari-mutuel regardless. Subtype only affects the create flow and card display.

### Bet Schema (Current + Additions)

```sql
bets:
  id                          uuid PRIMARY KEY
  crew_id                     uuid NOT NULL
  night_id                    uuid
  type                        text NOT NULL CHECK (type IN ('prop', 'h2h'))     ← UPDATED
  subtype                     text CHECK (subtype IN ('yesno', 'overunder', 'multi'))  ← NEW
  title                       text NOT NULL
  description                 text
  line                        numeric(6,1)                                       ← NEW (over/under)
  created_by_membership_id    uuid NOT NULL
  challenger_membership_id    uuid
  status                      text NOT NULL CHECK (status IN (
                                'open', 'pending_result', 'disputed',
                                'resolved', 'void', 'cancelled'
                              ))                                                 ← UPDATED
  winning_option_id           uuid
  pending_result_option_id    uuid REFERENCES bet_options(id)                    ← NEW
  pending_result_at           timestamptz                                        ← NEW
  void_reason                 text
  closes_at                   timestamptz NOT NULL
  resolved_at                 timestamptz
  resolution_source           text
  created_at                  timestamptz NOT NULL DEFAULT now()
  updated_at                  timestamptz NOT NULL DEFAULT now()
```

**Fields removed from spec v1:** `challengerAccepted`, `challengeExpiresAt`, `pending_accept` status. These are deferred — H2H accept/decline is post-hackathon. For tonight, verbal confirmation at the table is sufficient.

**Status enum changes:**
- Removed `'locked'` — effectively unused. The server `closes_at` check is the real guard. Bets stay `'open'` until resolution is proposed.
- Added `'pending_result'` — 60-second confirmation window after creator proposes a result.
- Kept `'disputed'` — crew voting in progress.
- Kept `'cancelled'` — for manual voids (distinct from auto-void for clarity).

### Client TypeScript Bet Interface

```typescript
export interface Bet {
  id: string
  type: 'prop' | 'h2h'
  subtype: 'yesno' | 'overunder' | 'multi' | null    // NEW
  title: string
  description?: string
  line?: number                                        // NEW — for over/under
  creator: User
  challenger?: User
  status: 'open' | 'pending_result' | 'disputed' | 'resolved' | 'void' | 'cancelled'
  closesAt: Date
  createdAt: Date
  options: BetOption[]
  totalPool: number
  result?: string                       // winning option ID
  pendingResultOptionId?: string        // NEW — proposed result during confirm window
  pendingResultAt?: Date                // NEW — when proposal was made
  voidReason?: string
  memberOutcomes?: BetMemberOutcome[]
}
```

---

## Part 3: Bet States & Lifecycle

### State Machine

```
                    ┌──────────┐
        create ───▶ │   OPEN   │
                    └────┬─────┘
                         │
           closes_at passes (server-enforced,
           no status change — stays 'open')
                         │
           creator proposes result
                         │
                  ┌──────▼────────┐
                  │PENDING_RESULT │ ◀── 60-second confirm window
                  └──────┬────────┘
                        / \
          no dispute   /   \  dispute raised
          (60s pass)  /     \
                     /       \
              ┌─────▼──┐  ┌──▼───────┐
              │RESOLVED│  │ DISPUTED │
              └────────┘  └────┬─────┘
                               │
                          crew votes (60s)
                              / \
                   majority /   \ tie
                           /     \
                    ┌─────▼──┐ ┌──▼──┐
                    │RESOLVED│ │VOID │
                    └────────┘ └─────┘
```

**Additional void/cancel paths:**
- OPEN → VOID: Timer expires and only one side has wagers (auto-void at resolution attempt)
- OPEN → CANCELLED: Creator manually cancels before any resolution
- OPEN → VOID: Night closes with bet still open (auto-void)

**Note on "locked":** There is no locked state. The `closes_at` timestamp on the server is the real guard — it rejects late wagers. The bet status stays `'open'` until a result is proposed. This is simpler and works fine. The client visually shows "Closed" and hides wager buttons based on `closes_at`.

### State Descriptions

**OPEN** — Bet is live. If `closes_at` hasn't passed, accepting wagers. If `closes_at` has passed, visually closed but status is still `'open'`, waiting for creator to propose a result. Server blocks late wagers via timestamp check.

**PENDING_RESULT** — Creator has proposed a winning option. 60-second confirmation window is active. All crew members see the proposed result and a countdown. Dispute button is visible. If 60 seconds pass with no dispute, auto-resolves.

**DISPUTED** — Someone hit "Dispute." Every crew member who wagered on this bet gets a vote. They vote for which option should win. 60-second vote window. Non-voters are counted as agreeing with the creator's original proposal. Majority wins. True tie = void.

**RESOLVED** — Winner declared, payouts calculated, ledger updated. Terminal state. Shows net results for each participant.

**VOID** — Cancelled due to: no opposing action, tie vote, or night close. All wagers returned. No ledger impact. Shows reason.

**CANCELLED** — Manually cancelled by creator before resolution. Functionally same as void. Separate status for clarity in history.

### Timing

| Phase | Duration | Notes |
|-------|----------|-------|
| Wagering window | Creator sets: 1 min, 2 min, 5 min, 15 min, 1 hour, end of night | Default: 2 min |
| Pending result confirmation | 60 seconds | Auto-resolves if no dispute |
| Dispute voting | 60 seconds | Non-votes = agreement with proposal |

### Resolution Flow (Step by Step)

**Step 1 — Wagering closes.** Timer expires. Client shows "Closed — awaiting result." Server blocks new wagers. Status stays `'open'`.

**Step 2 — Creator proposes.** Creator taps the winning option. Server sets `pending_result_option_id`, `pending_result_at = now()`, transitions status to `'pending_result'`. If only one option has wagers at this point, skip to auto-void.

**Step 3a — No dispute (happy path).** 60 seconds pass. Either:
- A client-side timer fires and calls `confirmResult` mutation, or
- The creator taps "Confirm" after 60 seconds
Server checks `pending_result_at + 60s <= now()`, then finalizes: runs pari-mutuel math, creates member outcomes, creates ledger entries, sets status to `'resolved'`.

**Step 3b — Dispute raised.** Any crew member taps "Dispute" within 60 seconds. Server transitions to `'disputed'`. Vote screen pushed to all participants.

**Step 4 — Voting.**
- Each voter picks which option they think should win
- 60-second voting window
- Non-votes count as agreement with `pending_result_option_id`
- Majority option wins → resolve with that option
- True tie → void

**Step 5 — Finalization.** Pari-mutuel payouts calculated. Ledger entries created. Notifications sent.

### Who Can Propose Results

| Bet Type | Who can propose |
|----------|----------------|
| Prop (all subtypes) | Creator only |
| Head-to-Head | Either player (creator or challenger) |

---

## Part 4: Bet Types

### Type 1: Yes/No Prop

Binary outcome. The default and most common bet.

**Data:**
```
type: 'prop'
subtype: 'yesno'
title: "Will Dave mention his ex tonight?"
line: null
options: [{ label: "Yes" }, { label: "No" }]
```

**Create flow:**
1. Tap "+" → "Yes / No"
2. Type the question
3. Pick your side (Yes or No) — places initial wager
4. Set wager amount (quick-select: 0.5, 1, 2, 3 — default 1)
5. Set close time (default 2 min)
6. Confirm → Bet goes live

**Card display (open):**
- Title prominent
- Two big tappable option boxes: YES / NO
- Each shows: pool size, number of bets, implied percentage (`option_pool / total_pool × 100`)
- Your wager highlighted on the side you picked
- Countdown timer (or "Closed" if past `closes_at`)
- Total pool
- Creator name

**Card display (pending_result):**
- Proposed winner highlighted with pulsing border
- 60-second countdown: "Confirming in 42s..."
- "Dispute" button visible to all participants

**Card display (resolved):**
- Winning side highlighted gold, losing side dimmed
- Each participant: name, what they bet, stake, net result
- Your personal net result prominent: "+1.2 🍺" or "-0.5 🍺"

**Card display (void):**
- Both sides greyed out
- Void reason displayed: "Voided — no one took the other side"

---

### Type 2: Over/Under

Binary bet with a numerical line. Same engine as Yes/No, different UI emphasis.

**Data:**
```
type: 'prop'
subtype: 'overunder'
title: "Jake's tequila shots"
line: 2.5
options: [{ label: "Over 2.5" }, { label: "Under 2.5" }]
```

**Create flow:**
1. Tap "+" → "Over / Under"
2. Type the subject: "Jake's tequila shots"
3. Set the line: 2.5 (number stepper, 0.5 increments, min 0.5)
4. Pick Over or Under — places initial wager
5. Set wager amount + close time
6. Confirm

**Card display (open):**
```
  Jake's tequila shots
       ─── 2.5 ───              ← line displayed big and centered
  [  OVER  ]    [  UNDER  ]
   2.0 🍺         1.0 🍺
   67%              33%
```

The `line` field is stored as a structured number so the UI can render it independently from the title. Option labels are auto-generated as "Over {line}" and "Under {line}".

**Push rule:** If someone sets a whole-number line (e.g., 3) and the result is exactly 3, the bet pushes (voids). Default the line stepper to 0.5 increments (0.5, 1.5, 2.5, 3.5...) to avoid this. Allow whole numbers but show a warning: "Exact hits on whole-number lines result in a void."

**Resolution:** Creator proposes Over or Under → standard pending_result flow.

---

### Type 3: Head-to-Head Challenge

Two named players face off. Rest of the crew places side bets.

**Data:**
```
type: 'h2h'
subtype: null
title: "Pool"
creator: Jake (the challenger)
challenger: You (the challenged)
options: [{ label: "Jake wins" }, { label: "You win" }]
// Both players auto-wager the agreed stake on themselves
```

**Create flow (hackathon version — no accept/decline):**
1. Tap "+" → "Challenge"
2. Pick your opponent from crew members
3. Type what you're playing: "Pool" / "Darts" / "Beer pong" / custom
4. Set the stake: how many drinks each player puts up (both wager the same amount)
5. Set side-bet close time
6. Confirm → Bet goes live immediately

**⚠️ POST-HACKATHON:** Add `pending_accept` state with accept/decline flow and 5-minute expiry. For the hackathon, verbal confirmation at the table before creating the challenge is sufficient. Document this as a known gap.

**Both players auto-wager on themselves.** When the bet is created, two wagers are placed automatically: the creator on their own option, and the challenger on their own option, both for the agreed stake amount. Side betting then opens for the rest of the crew.

**Card display (open):**
```
  ⚔️ HEAD TO HEAD               3:21

       Jake          vs         You
       2 🍺 stake               2 🍺 stake

  Side bets:
  [Jake wins]              [You win]
   3.5 🍺 (4 bets)         2.0 🍺 (2 bets)

  Total pool: 9.5 🍺
```

The two players' stakes should be visually distinct from side bets. Show them as the "main event" with side bets below.

**Resolution:** Either player can propose the result (not just the creator — both were there). Standard pending_result flow.

**Payout:** The two players' stakes are part of the pool. If Jake and You each bet 2, and 3 friends place side bets, the total pool is 4 + side bets. Winners split the full losing pool proportionally — the winning player gets their stake back plus their share of all losing wagers (opponent's stake + losing side bets).

---

### Type 4: Multi-Option / Prediction (Polymarket Style)

3+ options. This is the "who will..." or "what will happen" format. Odds shift as people bet.

**Data:**
```
type: 'prop'
subtype: 'multi'
title: "Who orders food first?"
line: null
options: [
  { label: "Jake" },
  { label: "Sarah" },
  { label: "Mike" },
  { label: "Dave" },
  { label: "Nobody" }
]
```

**Create flow:**
1. Tap "+" → "Prediction"
2. Type the question
3. Add options — either:
   - **Manual:** Type custom options
   - **Crew shortcut:** Quick-add button that populates all crew member names as options (this is the "First To..." template — no separate bet type needed)
4. Minimum 3 options, maximum 8
5. Creator picks one option and places initial wager
6. Set close time
7. Confirm

**Card display (open):**
```
  🎯 PREDICTION                  5:43

  Who orders food first?

  Jake     ██████████░░  2.5 🍺  42%
  Sarah    ████░░░░░░░░  1.0 🍺  17%
  Mike     ███░░░░░░░░░  0.5 🍺   8%
  Dave     █████░░░░░░░  1.5 🍺  25%
  Nobody   ██░░░░░░░░░░  0.5 🍺   8%

  Pool: 6.0 🍺    Your bet: 1 on Jake
```

Each option shows: label, pool share bar, drink total, percentage. Tap an option to bet on it.

**One wager per person:** You can only bet on one option. Tapping a different option prompts: "Move your 1 🍺 bet from Jake to Sarah?" This prevents hedging and keeps the math simple.

**Resolution:** Creator proposes winning option → standard pending_result flow.

---

## Part 5: Ledger Integration

### How Bet Results Become Drink Debts

When a bet resolves, the engine produces member outcomes:
```
[
  { user: Alice, stake: 1, netResult: +0.5 }    // winner
  { user: Ben,   stake: 2, netResult: +1.0 }    // winner
  { user: Cara,  stake: 1, netResult: -1.0 }    // loser
  { user: Dan,   stake: 0.5, netResult: -0.5 }  // loser
]
```

These convert into **pairwise ledger entries**. Each loser's loss is distributed across winners proportionally to each winner's profit:

```
Total winner profit: 1.5 (Alice 0.5 + Ben 1.0)

Cara loses 1.0:
  → Cara owes Alice: 1.0 × (0.5 / 1.5) = 0.33
  → Cara owes Ben:   1.0 × (1.0 / 1.5) = 0.67

Dan loses 0.5:
  → Dan owes Alice: 0.5 × (0.5 / 1.5) = 0.17
  → Dan owes Ben:   0.5 × (1.0 / 1.5) = 0.33
```

**Rounding:** Floor each allocation. Give remainder to the last winner in the list for each loser (ensures each loser's allocations sum exactly to their loss).

### Ledger Views

- **Per-pair:** Sum all entries between two people, subtract settled amounts. "You owe Jake 1.7 drinks" across multiple bets.
- **Per-night:** Filter by nightId for tonight's view.
- **All-time:** All entries across all nights. Never resets.
- **Net position:** One number. Sum of all drinks owed to you minus all you owe. "+3.4" or "-1.2".

### Settlement

When a drink is bought in real life, both people confirm in the app. Two taps. The ledger entry's `settled` amount increments by 1 (one drink). Partial settlement is fine — you don't have to clear the whole balance at once.

---

## Part 6: Tournaments

Tournaments wrap multiple Head-to-Head bets into a bracket with an additional side-betting layer.

### Structure

A tournament has:
- **Participants:** 4 or 8 crew members
- **Game type:** Pool, darts, beer pong, etc.
- **Format:** Single elimination or double elimination
- **Seeding:** Random or manual
- **Entry pot (optional):** Each participant contributes X drinks. Winner takes all or configured split.
- **Overall winner bet:** Auto-created multi-option bet where options are all participants.

### How It Works

**Creation:**
1. Creator selects "Tournament"
2. Picks game type, selects participants (4 or 8)
3. Chooses format and seeding
4. Sets optional entry pot (e.g., 2 drinks per person)
5. Confirms → Bracket generated, overall winner bet created

**Bracket:**
- 4 players: 2 semi-finals → 1 final (3 matches)
- 8 players: 4 quarter-finals → 2 semi-finals → 1 final (7 matches)

**Match flow:**
Each match is a H2H bet. When a round opens:
1. Next matches become active
2. Players are auto-paired (no accept/decline — they agreed by entering)
3. Side betting opens for the crew
4. Match plays out → standard resolution
5. Winner advances, next round opens

### Three Betting Layers

1. **Entry pot** — Optional buy-in. Winner takes all (or split: 70/30, configurable).
2. **Match side bets** — Each match is a H2H with crew side bets. Standard pari-mutuel.
3. **Overall winner bet** — Multi-option bet on who wins the whole thing. Runs the full tournament.

These are independent. Someone eliminated in round 1 can still win drinks from side bets and the overall winner bet.

### The Fun Tension

The person who wins the tournament might still owe more drinks than they earned if they bet badly on other matches. Winning the game doesn't mean winning the night.

### Data Model

```sql
tournaments:
  id                          uuid PRIMARY KEY
  crew_id                     uuid NOT NULL
  night_id                    uuid
  title                       text NOT NULL
  game_type                   text NOT NULL
  format                      text NOT NULL CHECK (format IN ('single_elim', 'double_elim'))
  status                      text NOT NULL CHECK (status IN ('setup', 'active', 'completed'))
  entry_pot_per_person        numeric(4,1) DEFAULT 0
  pot_split_winner_pct        integer DEFAULT 100
  pot_split_runner_up_pct     integer DEFAULT 0
  overall_winner_bet_id       uuid REFERENCES bets(id)
  created_by_membership_id    uuid NOT NULL
  created_at                  timestamptz NOT NULL DEFAULT now()
  updated_at                  timestamptz NOT NULL DEFAULT now()

tournament_participants:
  id                          uuid PRIMARY KEY
  tournament_id               uuid NOT NULL REFERENCES tournaments(id)
  membership_id               uuid NOT NULL
  seed                        integer NOT NULL
  eliminated_at               timestamptz

tournament_matches:
  id                          uuid PRIMARY KEY
  tournament_id               uuid NOT NULL REFERENCES tournaments(id)
  round                       integer NOT NULL
  position                    integer NOT NULL
  bracket_type                text DEFAULT 'winners' CHECK (bracket_type IN ('winners', 'losers'))
  player1_membership_id       uuid
  player2_membership_id       uuid
  winner_membership_id        uuid
  bet_id                      uuid REFERENCES bets(id)
  status                      text NOT NULL CHECK (status IN ('upcoming', 'active', 'completed'))
  created_at                  timestamptz NOT NULL DEFAULT now()
  updated_at                  timestamptz NOT NULL DEFAULT now()
```

### Tournament Display

**Bracket view:**
```
  🏆 TOURNAMENT                 Round 2
  Beer Pong Championship

  ┌ Jake ✓──┐
  └ Sarah   ┘──┐
                ├── FINAL ──▶ ???
  ┌ Mike    ┐──┘
  └ Dave ✓──┘

  Entry pot: 8 🍺    Overall winner bet: 12 🍺 pool
  [View bracket]  [Bet on winner]
```

Each match tappable to see H2H detail and place side bets.

**Resolution:** When the final match resolves, the overall winner multi-option bet auto-resolves, entry pot distributes, tournament status → completed.

**Priority:** Tournament tables and logic are post-hackathon. Don't build until the core bet types are solid.

---

## Part 7: Edge Cases

### Handled Correctly (Verified)

| Scenario | Behavior | Verified |
|----------|----------|----------|
| Everyone bets same side | Void — no opposing action | ✓ `fundedOptions.length <= 1` |
| One winner, many losers | Winner takes entire losing pool | ✓ |
| Creator is only bettor, nobody joins | Void — only one funded option | ✓ |
| Wager replacement (switch sides) | Old wager removed, new placed | ✓ `placeOrUpdateBetWager` |
| Winning option has zero wagers | Void — can't distribute to nobody | ✓ `totalWinningStakeCents <= 0` |

### Needs Attention

| Scenario | Current Behavior | Correct Behavior | Fix |
|----------|-----------------|-------------------|-----|
| Huge stake imbalance (5 vs 0.5) | Technically works | Show projected payout BEFORE confirming so user understands they're risking 5 to win 0.5 | Display fix |
| H2H created without challenger consent | Bet goes live immediately | For hackathon: verbal confirmation. Post-hackathon: pending_accept state | Post-hackathon |
| Bet timer expires, sits as 'open' forever | Stays open until night close | Fine for now — night close auto-voids. No server-side cron needed yet. | Acceptable |
| Dispute with only 2 bettors who disagree | 1-1 tie → void | Correct — no consensus means cancel | ✓ |
| Same person wagers then bet voids | Wager returned | Correct — void means no impact | ✓ |
| Bet closes exactly as wager submitted | Server checks `closes_at > now()` | Adequate for hackathon. Production: database-level constraint. | Acceptable |
| Non-voters in dispute | Not counted | Should count as agreeing with creator's proposal | Fix in dispute logic |

---

## Part 8: Implementation Plan

### Batch 1 — Quick Wins (30 min)

**Do these first. All are small, isolated, no dependencies.**

1. **Max wager cap** — Add `drinks <= 5` check to:
   - Client: `isValidWagerAmount` in `lib/store.ts`
   - Server: `placeWager` handler in `lib/server/repository.ts`
   - SQL: `ALTER TABLE wagers ADD CONSTRAINT wagers_max_drinks CHECK (drinks <= 5)`

2. **Client remainder alignment** — In `resolveBetWithParimutuel`, replace the round-robin remainder loop with: give full remainder to `winningWagers[0]` (already sorted largest-stake-first).

3. **Projected payout rounding** — In `projectBetPayout`, change `Math.round` to `Math.floor`.

4. **Client type union** — Update `Bet['type']` to `'prop' | 'h2h'` (remove any `'multi'` if present in type, it moves to subtype).

### Batch 2 — Schema Migration (1-2 hours)

**One migration, all schema changes together.**

5. Add `subtype` column: `text CHECK (subtype IN ('yesno', 'overunder', 'multi'))`, nullable.
6. Drop `'multi'` from `type` check constraint. Update to `CHECK (type IN ('prop', 'h2h'))`.
7. Add `line` column: `numeric(6,1)`, nullable.
8. Add `pending_result_option_id` column: `uuid REFERENCES bet_options(id)`, nullable.
9. Add `pending_result_at` column: `timestamptz`, nullable.
10. Update `status` check constraint: add `'pending_result'`, remove `'locked'` if present.
11. Update client TypeScript interfaces to match.

### Batch 3 — Pending Result Lifecycle (2-3 hours)

**This is the most important new logic. Without it, results are instant with no dispute window.**

12. New mutation: `proposeResult(betId, optionId)` — Sets `pending_result_option_id`, `pending_result_at = now()`, status → `'pending_result'`. Validates: only creator (or either player for H2H) can propose. Auto-voids if only one side is funded.

13. New mutation: `confirmResult(betId)` — Checks `pending_result_at + 60s <= now()` and no active dispute. Finalizes: runs pari-mutuel, creates outcomes, creates ledger entries, status → `'resolved'`.

14. New mutation: `disputeResult(betId)` — Any participant can call within 60 seconds. Status → `'disputed'`. Creates dispute record, notifies all participants.

15. New mutation: `castDisputeVote(disputeId, optionId)` — Records vote. After 60 seconds or all votes in, tallies: majority wins → resolve with majority option, tie → void.

16. Update existing `resolveBet` — Route through `proposeResult` instead of instantly resolving. Remove direct resolution path.

### Batch 4 — Test Expansion (1 hour)

17. Add these scenarios to `payout-scenarios.ts`:
    - Single winner takes full losing pool
    - Large stake imbalance (5 vs 0.5)
    - 5 options with distributed wagers
    - Void: no opposing action
    - Void: winning option has no wagers
    - H2H with side bets
    - 3-way even split
    - Rounding stress test (3 winners splitting 0.5)

### Skip for Hackathon

- `pending_accept` for H2H — verbal confirmation tonight
- Tournament tables and logic — separate feature
- Server-side auto-lock cron — `closes_at` check is sufficient
- Push notifications — nice-to-have, not blocking

---

## Appendix: Test Scenarios

These should all be in `tests/eval/payout-scenarios.ts` and pass against `resolveBetWithParimutuel`.

```typescript
{
  name: 'single winner takes full losing pool',
  winningOptionId: 'a',
  options: [
    { id: 'a', wagers: [{ userId: 'alice', drinks: 2 }] },
    { id: 'b', wagers: [
      { userId: 'bob', drinks: 1 },
      { userId: 'cara', drinks: 1.5 },
      { userId: 'dan', drinks: 0.5 },
    ]},
  ],
  expectedNetByUser: { alice: 3, bob: -1, cara: -1.5, dan: -0.5 },
}

{
  name: 'large stake imbalance',
  winningOptionId: 'a',
  options: [
    { id: 'a', wagers: [{ userId: 'alice', drinks: 5 }] },
    { id: 'b', wagers: [{ userId: 'bob', drinks: 0.5 }] },
  ],
  expectedNetByUser: { alice: 0.5, bob: -0.5 },
}

{
  name: '5 options distributed wagers — option C wins',
  winningOptionId: 'c',
  options: [
    { id: 'a', wagers: [{ userId: 'alice', drinks: 1 }] },
    { id: 'b', wagers: [{ userId: 'bob', drinks: 1 }, { userId: 'cara', drinks: 0.5 }] },
    { id: 'c', wagers: [{ userId: 'dan', drinks: 2 }] },
    { id: 'd', wagers: [{ userId: 'emma', drinks: 1 }] },
    { id: 'e', wagers: [] },
  ],
  expectedNetByUser: { dan: 3.5, alice: -1, bob: -1, cara: -0.5, emma: -1 },
}

{
  name: 'void — no opposing action (all on same side)',
  winningOptionId: 'a',
  options: [
    { id: 'a', wagers: [{ userId: 'alice', drinks: 2 }, { userId: 'bob', drinks: 1 }] },
    { id: 'b', wagers: [] },
  ],
  expectedVoid: true,
}

{
  name: 'void — winning option has no wagers',
  winningOptionId: 'a',
  options: [
    { id: 'a', wagers: [] },
    { id: 'b', wagers: [{ userId: 'alice', drinks: 1 }, { userId: 'bob', drinks: 2 }] },
  ],
  expectedVoid: true,
}

{
  name: 'h2h with side bets',
  winningOptionId: 'jake',
  options: [
    { id: 'jake', wagers: [
      { userId: 'jake', drinks: 2 },
      { userId: 'emma', drinks: 1 },
    ]},
    { id: 'you', wagers: [
      { userId: 'you', drinks: 2 },
      { userId: 'sarah', drinks: 1.5 },
    ]},
  ],
  expectedNetByUser: {
    jake: 2.33,
    emma: 1.17,
    you: -2,
    sarah: -1.5,
  },
}

{
  name: '3-way even split',
  winningOptionId: 'a',
  options: [
    { id: 'a', wagers: [{ userId: 'alice', drinks: 1 }] },
    { id: 'b', wagers: [{ userId: 'bob', drinks: 1 }] },
    { id: 'c', wagers: [{ userId: 'cara', drinks: 1 }] },
  ],
  expectedNetByUser: { alice: 2, bob: -1, cara: -1 },
}

{
  name: 'rounding stress test — 3 winners splitting 0.5',
  winningOptionId: 'a',
  options: [
    { id: 'a', wagers: [
      { userId: 'alice', drinks: 0.5 },
      { userId: 'ben', drinks: 0.5 },
      { userId: 'cara', drinks: 0.5 },
    ]},
    { id: 'b', wagers: [{ userId: 'dan', drinks: 0.5 }] },
  ],
  // Losing pool: 0.5. Split 3 ways: floor(0.5/3 * 100)/100 = 0.16 each
  // Remainder: 0.50 - 0.48 = 0.02 → alice (top rank: same stake, earliest)
  expectedNetByUser: { alice: 0.18, ben: 0.16, cara: 0.16, dan: -0.5 },
}
```

**Note on void scenarios:** The test harness may need updating to handle `expectedVoid: true` — check that `resolved.status === 'void'` and `resolved.memberOutcomes` is empty.
