Original prompt: Based on the vibe of this app cna you develop a simialr game to crocodile teeth. I want it to be the first of our mini gaems which you cna play against people for drink on the. On the tab for creating bets there will ch challenege at mini game. SO please create a themed version of that game and build in the logic. We also need people to be able to challenege someone, they accept, set the wager and then play. Test the game out first to get that working and tehn after design all the logic of the chellenging wagering and post game. use sub agents for testing and building the game

2026-03-21
- Beer Bomb mini-game flow is implemented as a dedicated mini-game path with challenge, accept/decline, cancel, turn-taking, and automatic ledger settlement.
- Client flow now trusts backend payloads for match ids, turn order, revealed slots, and completed outcomes.
- Beer Bomb modal keeps local tap animation only; it does not infer the hidden bomb before the backend reveals completion.
- Sprite pipeline placeholders/docs exist under `game-sprites/` and `public/mini-games/beer-bomb/`.

Verification
- `npm run typecheck`
- `npm run test:unit`
- `npx vitest run tests/integration/backend-contract.test.ts`

Notes
- `npm run dev` is currently serving locally on `http://localhost:3001` because port 3000 was already in use.
- No dedicated browser smoke for the authenticated Beer Bomb flow was run in this pass.
