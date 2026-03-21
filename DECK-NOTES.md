# BeerScore Hackathon Deck — Iteration Notes

## Current State (March 21, 2026)

12-slide dark-themed deck with gold/amber accents matching the app aesthetic. Tongue-in-cheek "Hangover" movie poster vibe.

## Slide Breakdown

| # | Title | Content | Status |
|---|-------|---------|--------|
| 1 | Title | "The BeerScore" — movie poster style, team names, pun titles | Needs real names |
| 2 | The Problem | Three pain-point cards about broken bar promises | Done |
| 3 | The Solution | Four pillars: real stakes, instant bets, ledger, receipts | Done |
| 4 | How It Works | Four numbered steps: crew → night → bets → settle | Done |
| 5 | The Bet System | Two-column: prop bets vs 1v1 challenges | Done |
| 6 | Built Different | 2x3 grid of AI tools used (Claude Code, Codex, Sub-Agents, Skills/MCPs, Worktrees, Vibe Coding) | Done |
| 7 | The Process | Timeline: Hour 0 → 1-8 → 9-16 → 24+ | Done |
| 8 | By The Numbers | Six stat callouts (75+ components, 16 screens, 3000+ LOC, 2 devs, 0 sleep, ??? drinks) | Update with final numbers |
| 9 | Under The Hood | Tech stack: Next.js, Supabase, Vercel, Auth | Done |
| 10 | The App | Three phone-shaped screenshot placeholders | Needs real screenshots |
| 11 | Field Test | "Tonight, we drink. For science." — March 22 plan | Done |
| 12 | Closing | Tagline + team credits | Needs real names |

## Before Presenting — Checklist

- [ ] Replace **PLAYER 1** and **PLAYER 2** with actual names (slides 1 & 12)
- [ ] Drop in real app screenshots after the night out (slide 10)
- [ ] Update stats on slide 8 with final numbers
- [ ] Consider adding a slide with actual night-out photos/results if compelling

## Team Title Options (pick your favorites)

- Chief Intoxication Officer
- VP of Pour Decisions
- Head of Liquid Assets
- Director of Pitcher-Perfect Engineering
- Chief Brew-tality Officer
- Senior Vice Pint
- Head of Hops-erations

## Ideas for Future Iterations

- **Add a "Results" slide after the night out** — real screenshots, actual bet examples, who won/lost, drinks owed. This is the "proof of concept" moment.
- **Morning-after recap screenshot** — if the app generates a recap, screenshot it and add as a slide. This is the shareable moment.
- **Before/after comparison** — show a messy group chat vs the clean BeerScore interface side by side.
- **Live demo video** — if screenshots aren't enough, a short screen recording of placing a bet and seeing the ledger update.
- **Audience participation** — consider ending with a live bet in the room using the app.
- **More AI process detail** — if judges care about the technical AI story, expand slide 6 or 7 with specifics (e.g., "Claude Code wrote the pari-mutuel algorithm in one prompt", "Sub-agents built 3 features simultaneously").
- **Funnier quotes** — sprinkle in more tongue-in-cheek lines. The deck's humor lands best when it's dry and confident, not trying too hard.

## Technical Details

- Built with PptxGenJS (Node.js)
- Color palette: bg `0D0B07`, amber `D4A017`, cream `F5E6C8`, muted `9B8E7A`, red `8B3A3A`
- Fonts: Impact (titles), Georgia (subtitles/taglines), Arial (body)
- To regenerate: the source script was `create-deck.js` — recreate from this notes file and the CLAUDE.md vision doc
