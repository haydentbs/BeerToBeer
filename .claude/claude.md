# SettleUp

*The betting app where the stakes are real drinks.*

Last Updated: March 20, 2026

-----

## The Idea

Your friend group already bets on everything. Who wins at pool, whether someone will order tequila, over/under on how many times Dave mentions his ex. Right now those bets live in your group chat, get forgotten, and never get settled.

SettleUp makes them real. Create a bet, your crew wagers drinks, it resolves, and the app tracks exactly who owes who — down to the fraction of a pint. No fake currency. No play money. You lose, you buy the next round.

The app is built around Nights — a living session for each time your crew goes out. Every bet, every result, every drink owed gets grouped into that Night. The next morning, SettleUp generates a recap of everything that happened: who won, who lost, who owes what. That recap is the shareable moment. It’s the proof. It’s the bragging rights.

Over time, those Nights stack up into an all-time leaderboard, a running ledger between every pair of friends, and a permanent record of who actually backs up their talk.

-----

## Who It’s For

Groups of friends who never stop competing. The crew that turns everything into a contest. College friends, roommates, bar regulars, rec league teammates, coworkers who go out on Fridays. 4-8 people who are already doing this — SettleUp just gives them structure, stakes, and receipts.

These people are competitive, social, and status-driven. Winning matters to them. Losing stings. And neither should be forgotten.

-----

## Core Concepts

### Crews

A Crew is your friend group inside SettleUp. Invite-only, typically 4-8 people. Everything lives within a Crew: bets, ledgers, leaderboards, Nights, history. You can be in multiple Crews, but each is its own self-contained world with its own rivalries and its own leaderboard.

### Nights

A Night is a session. Someone opens a Night, the Crew joins in, and that’s when bets go live. Every bet placed, every result logged, every drink movement during an outing gets grouped under that Night.

Nights have a lifecycle:

•⁠  ⁠*Active* — Bets are being created and resolved. The Night is live.
•⁠  ⁠*Winding down* — No activity for a while, but nobody has formally closed it. Anyone can still create a bet and reactivate it.
•⁠  ⁠*Soft close* — Extended inactivity (3-4 hours with no bets). The Night is effectively over but not finalized.
•⁠  ⁠*Hard close* — Either everyone in the Crew manually says “night’s over,” or the app auto-closes the next morning at a set time (whichever comes first). This is when the final recap generates.

At any point during a Night, anyone can check the current state — who’s up, who’s down, what bets are open. You don’t have to wait until it ends.

One-off bets outside of a Night are also supported. Not everything needs to be part of a big session — sometimes you just want to make a quick bet on a Tuesday afternoon.

### Bets

Every bet in SettleUp runs on a pari-mutuel system. Everyone wagers drinks into a shared pool. When the bet resolves, the winners split the entire pot proportionally based on how much they put in. The fewer people on the winning side, the bigger the payout. This means odds emerge naturally from how your friends bet — no algorithms, no house edge, just your crew’s collective read on the situation.

There are two types of bets:

*Prop Bets* — Open questions anyone in the Crew can create. These are the social bets: “Will the bouncer check our IDs,” “over/under 2.5 times Mark checks his phone in the next 10 minutes,” “who orders food first.” Anyone in the Crew can wager. These are where the laughs come from and where people who aren’t playing a game stay engaged.

*Head-to-Head Challenges* — Direct callouts between two people. “I challenge you to darts, 2 drinks on the line.” The challenged person accepts or declines. Once it’s live, the rest of the Crew can place side bets on either person through the same pari-mutuel pool. The challenge creates a moment between two people; the side bets give everyone else skin in the game.

*Bet creation needs to be faster than saying “wanna bet?”* Tap, type a quick description or pick a format (yes/no, over/under, who wins), set the wager, set the close time — done. The Crew gets notified. Most bets should close for wagering within 1-2 minutes for in-the-moment stuff, with the option for longer windows on bigger bets.

### Resolution

When a bet ends, the creator proposes the outcome. A 60-second window opens. If nobody disputes it, the result locks and the ledger updates automatically.

If someone disputes: every Crew member gets a quick vote on their phone. Majority wins. If it’s a true tie, the bet cancels — no one wins, no one loses, all drinks return. No coin flips, no random outcomes. Cancelling is the fair default.

This keeps the night moving. Most bets resolve in under a minute.

### The Ledger

The Ledger is the heart of SettleUp. It tracks drink debt between every pair of people in the Crew, down to fractions. You might owe Sarah 0.3 drinks from last Tuesday and pick up another 0.7 tonight — that’s a full drink. Time to settle.

The Ledger has two layers:

•⁠  ⁠*Tonight* — What’s happened this session. Your current position, what you’ve won and lost, and against who. This is the live view you check throughout the night.
•⁠  ⁠*All-time* — The running total across every Night and every one-off bet. This never resets. Three weeks from now, the app still knows Jake owes you 1.4 drinks. The full history of how your balance with any person has changed over time is visible — you can see the trajectory of every rivalry.

Fractional drinks accumulate. Once a debt between two people reaches a full drink (or more), it’s owed. The debtor doesn’t have to settle the entire balance at once — buying one drink reduces the ledger by one. Partial settlement is fine. Debts carry across Nights until settled.

*Settlement:* When a drink is bought in real life, both people confirm it in the app. Two taps, one from each person. The ledger updates. This is a small ritual — pull out your phone, confirm, watch the number move. It makes the settlement real and trackable.

### The Leaderboard

Each Night produces a mini-leaderboard: who came out on top that session, biggest winner, biggest loser. Those roll up into the all-time Crew leaderboard.

All-time stats tracked:

•⁠  ⁠*Total drinks won* — The headline number. The one people brag about. “I’ve won 47 drinks off this crew.”
•⁠  ⁠*Win rate* — Percentage of bets won across all Nights.
•⁠  ⁠*Best Night* — Your single highest-earning session.
•⁠  ⁠*Current streak* — Consecutive Nights finishing in the positive.
•⁠  ⁠*Head-to-head records* — Your record against every individual Crew member. This is where rivalries live.

The leaderboard is visible at all times — not just during Nights. It’s the thing people check on a random Wednesday to see where they stand.

-----

## Tournaments

Tournaments are a stretch feature for the hackathon MVP but a core part of the post-launch vision.

Someone creates a bracket — 4 or 8 people, single elimination, pick the game (pool, beer pong, darts, whatever). The app generates the bracket. Every match in the bracket is a Head-to-Head Challenge with side bets open to the rest of the Crew.

Before the tournament starts, everyone can place bets on the overall winner. As matches play out, the bracket updates live and side betting opens for each new round.

The beautiful tension: the person who wins the tournament might still owe more drinks than they earned if they bet poorly on other matches. Winning the game doesn’t mean winning the night.

Tournament options:

•⁠  ⁠*Format* — Single elimination, double elimination, round robin
•⁠  ⁠*Seeding* — Random or based on leaderboard standing
•⁠  ⁠*Starting pot* — Optional drink buy-in from all participants
•⁠  ⁠*Side bets* — Open on individual matches and overall winner

-----

## The Morning-After Recap

The recap is the shareable moment. It’s what makes people who weren’t there wish they were, and the proof for everyone who was.

When a Night hard-closes (either manually or by auto-close the next morning), the app generates a full summary:

•⁠  ⁠Total bets placed and resolved
•⁠  ⁠Biggest winner and biggest loser
•⁠  ⁠Best single bet (highest payout)
•⁠  ⁠Biggest upset
•⁠  ⁠Updated ledger showing all drink movements from the Night
•⁠  ⁠Head-to-head highlights and rivalry updates
•⁠  ⁠Net position change for every Crew member

During an active Night, anyone can pull up a live version of this at any time — a snapshot of where things stand right now. This is useful if someone leaves early or just wants to check the score. It’s the same information as the final recap, just not finalized.

The final morning-after version is designed to be shared — screenshot-ready, with all the stats, callouts, and results in a format that works in a group chat, on a story, or anywhere else.

-----

## Notifications

Notifications are important for keeping the energy up during a Night:

•⁠  ⁠*New bet created* — Especially if it’s about you or mentions you
•⁠  ⁠*Someone challenged you* — Direct Head-to-Head callout, needs your response
•⁠  ⁠*Bet closing soon* — Last chance to get your wager in
•⁠  ⁠*Bet resolved* — What happened, what you won or lost
•⁠  ⁠*Dispute called* — A bet needs your vote
•⁠  ⁠*Drink owed* — Your balance with someone crossed a full drink threshold
•⁠  ⁠*Settlement confirmed* — Someone marked a drink as settled, needs your confirmation
•⁠  ⁠*Night recap available* — Morning-after summary is ready

-----

## Design & Feel

### The Vibe

Premium, dark, competitive, with warmth. SettleUp should feel like a sportsbook that lives at your local pub. Not corporate, not silly — confident and a little cocky. The competition is taken seriously. The prize just happens to be beer.

Think the polish of a high-end sports betting interface, stripped down, warmer, and designed for 6 friends at a bar instead of millions of strangers online.

### Visual Direction

•⁠  ⁠*Dark background* — Near-black with a slight warm undertone. This is a night-out app. It needs to look good in a dim pub and not blast your face with light.
•⁠  ⁠*Gold/amber primary accent* — Pulled from the trophy-pint icon. Gold for wins, positive movements, achievements. It should feel like a reward every time you see it.
•⁠  ⁠*Muted red for losses* — Drink debts, negative ledger movements, losing bets. Not aggressive or alarming — just enough to sting.
•⁠  ⁠*White/cream for text* — Clean, high contrast, readable after a few drinks.

### Typography

Bold, clean sans-serif. The numbers are the stars — ledger balances, leaderboard positions, payout amounts. They should feel important. When you see “+2.4 drinks” it should hit like checking a portfolio that’s up. Nothing playful or rounded in the fonts. Keep it sharp.

### Animations & Feedback

Satisfying, not cute. When a bet resolves in your favor, a quick gold flash, the number ticking up. When you lose, a subtle red pulse. The feeling should be closer to a slot machine hitting than a cartoon celebration. Punchy, fast, rewarding. No clinking beer glass animations or confetti — let the numbers do the talking.

### UX Principles

•⁠  ⁠*Fast* — One-thumb operation. Creating a bet should take fewer taps than typing a text message. Logging a result should be near-instant.
•⁠  ⁠*Readable* — Designed for dark environments and impaired coordination. Big tap targets, high contrast, nothing that requires precision.
•⁠  ⁠*Competitive* — Every screen should remind you where you stand. The ledger and leaderboard are never more than one tap away.
•⁠  ⁠*Mobile-forward* — Built as a web app optimized for mobile. Desktop version supported but mobile is the primary experience. Native app wrapping comes later.

-----

## MVP Scope (Hackathon Build)

The hackathon build proves one thing: the core loop of creating bets, wagering drinks, resolving outcomes, and seeing the ledger update is fun and frictionless with a group of friends.

### Must Have

•⁠  ⁠Create and join a Crew
•⁠  ⁠Open and close a Night
•⁠  ⁠Create Prop Bets (yes/no, over/under, multi-option)
•⁠  ⁠Create Head-to-Head Challenges with side bets
•⁠  ⁠Pari-mutuel wagering with fractional drink tracking
•⁠  ⁠Bet resolution with dispute flow (crew vote, 60-second timer)
•⁠  ⁠Live Ledger — tonight’s view with user-to-user balances
•⁠  ⁠All-time Ledger — running totals that persist across Nights
•⁠  ⁠Drink settlement confirmation (both parties confirm)
•⁠  ⁠Crew Leaderboard — per-Night and all-time
•⁠  ⁠Direct 1v1 challenges

### Should Have (Build If Time Allows)

•⁠  ⁠Push notifications for new bets, challenges, and resolutions
•⁠  ⁠Night recap / morning-after summary screen
•⁠  ⁠Shareable recap format
•⁠  ⁠Tournament bracket creation with side betting
•⁠  ⁠Leaderboard stats beyond total drinks won (win rate, streaks, head-to-head records)

### Post-Hackathon Roadmap

•⁠  ⁠Full tournament and bracket support
•⁠  ⁠Advanced leaderboard and personal stats
•⁠  ⁠Rivalry tracking and head-to-head deep dives
•⁠  ⁠Seasonal or time-boxed competitions within Crews
•⁠  ⁠Multiple Crew support with cross-Crew leaderboards
•⁠  ⁠Native app wrapper for iOS and Android
•⁠  ⁠Onboarding and tutorial flow
•⁠  ⁠Cosmetics and customization (crew themes, profile flair)
•⁠  ⁠Premium features (advanced stats, custom bet types)

-----

## What Makes SettleUp Work

It’s not the betting mechanics — it’s that every bet is a social moment with your actual friends, the stakes are real enough to care about, and the ledger never forgets.

The verbal bet at the bar gets forgotten. The group chat message gets buried. SettleUp is the permanent record. Three weeks from now, the app still knows Jake owes you a drink. That persistence is what turns a night-out gimmick into something people keep opening.

Competition is everything. We’re just giving it a tab.