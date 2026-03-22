# 🍺 SettleUp

**Bet your mates drinks. The app keeps score.**

SettleUp is a social betting and drinking game app for nights out. Create a crew, start a night, bet each other real drinks on anything, and let the app track who owes who — down to the decimal. Built in a weekend by two people and an army of AI agents. Tested at an actual pub. Finished at sunrise.

> *The name evolved with the product: BeerScore → BeerToBeer → BeerScore → SettleUp. The last one stuck — it's what people actually say at the bar.*

---

## What it does

**Group bets** — "Will Dave mention his ex?" Create it in a few taps. Everyone bets drinks into a pari-mutuel pool. Winners split the lot. Yes/no, over/under, multi-option prediction markets — whatever you want to bet on.

**1v1 challenges** — Challenge someone to pool, darts, whatever. Both put drinks on the line. The rest of the crew piles on side bets.

**Beer Bomb** — Minesweeper but you're drinking. Two players take turns tapping tiles. One's the bomb. Hit it and you're buying. Ended up being the most popular thing in the app during our field test — mini-games get the night going fast, and early losses make people bet bigger to try and win it back.

**The drink ledger** — Tracks every fraction of a drink owed between every pair of people in the crew. Carries across nights. When someone actually buys a drink, both people confirm in the app. The ledger never forgets. Three weeks from now it still knows you owe Jake 1.4 drinks.

**Crew leaderboards** — All-time drinks won, win rate, best night. The stats that fuel bragging rights.

**QR code instant join** — Scan a code and you're in the crew and the active night immediately. We built this at the pub when we realised new players were taking too long to get started.

**Three display modes** — Light, Classic (our default), and Dark. Designed for pub environments — usable at midnight without blinding anyone, readable during the day. Plus six drink theme colour palettes for crew customisation.

---

## The weekend

### Friday evening
Did the hackathon inductions. Went straight to a pub to figure out what we were building. Came back with a vision doc and a plan.

### Saturday morning
Fed the vision doc to Claude Code. By mid-morning we had a working prototype — crews, nights, bets, pari-mutuel engine, auth. But the database was rushed and everything was slow.

### Saturday 6 PM
Made a hard call. The initial database schema was fundamentally holding us back. We wiped the entire Supabase database, designed v2 from scratch (20+ tables, row-level security on every one), and rebuilt. Painful. Necessary.

### Saturday 11 PM — Pub-Driven Development
Set up Claude Code for remote dispatch. Went to the pub. Ordered a beer. Opened the app.

It half-worked. Timer labels confused everyone. "Prop Bet" was jargon nobody understood (we renamed it to "Group Bet" on the spot). Beer Bomb — which we'd built that morning as a quick side feature — got more play than every bet combined.

We opened Claude Code on a phone and started shipping fixes from bar stools over 5G. Built QR code instant join because onboarding was too slow. Pushed to production from the pub. Tested, played, broke things, fixed things, played again — pints in hand.

### Midnight – 6 AM
Cut the night short. Home. Both laptops open within 20 minutes. Full sprint until sunrise. Rewrote the bet creation UX, rebuilt the tonight screen, added Beer Bomb realtime sync via Supabase Broadcast, polished the leaderboard, tuned animations, fixed the invite flow, and dozens of other changes. Every single fix was driven by something we'd experienced at the bar three hours earlier.

The git log tells the story: **"haydentbs and claude committed"** on every push, all night.

---

## Our AI stack

We used four AI tools and the most interesting part was figuring out what each one is actually good at.

| Tool | What we used it for |
|------|-------------------|
| **v0 + Vercel** | Design exploration (went through several directions before landing on the look), instant deploys on push |
| **Cursor** | Our IDE home base. Composer v2 for fast edits — renaming, colours, finding things. Terminal for Claude Code sessions, localhost, git |
| **Claude Code** | Architecture, complex bugs, code consistency. The planning layer — Claude scoped work before we handed it to Codex. Remote dispatch from the pub at midnight |
| **Codex** | Heavy lifting. DB v2 migration, major feature builds, agentic testing. Spawned sub-agents (Dalton, Rawls, Zeno) to review code in parallel |

**Skills:** frontend-design, supabase, postgres, webapp-testing, algorithmic-art

**MCPs:** Supabase MCP, Vercel MCP, Playwright MCP

The workflow: we wrote vision docs and specs, Claude planned and broke tasks down, Codex built, Cursor polished, and Claude dispatched fixes remotely when we were at the pub. Two people directing an army of agents.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Components | Radix UI + shadcn/ui |
| Fonts | Bungee (display), Lexend (body), Geist Mono (codes) |
| Backend | Supabase — PostgreSQL, Auth, Realtime Broadcast |
| Database | 20+ tables, RLS on every table, pari-mutuel engine |
| Auth | Google OAuth, guest mode, crew codes, QR instant join |
| Deploy | Vercel, auto-deploy on push, PWA-ready |

---

## What's next

We're not putting this down. This is a product, not a project.

- Tournament brackets with side betting
- AI commentary and roasts based on crew history
- More mini-games
- Morning-after recap generation
- Native iOS + Android
- Bar and venue partnerships

---

## Team

**Hayden Tibbals** — Full-stack development, AI orchestration, product design

**Charles Keenen** — Full-stack development, database architecture, field testing

And a special thanks to Dalton, Rawls, and Zeno — the three Codex sub-agents who reviewed our codebase at 4 AM so we didn't have to.

---

*Competition is everything. We're just giving it a tab.*