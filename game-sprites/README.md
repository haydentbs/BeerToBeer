# Beer Bomb Sprite Checklist

Drop the source art for the first mini-game into this folder before final art integration.

Required source files:

- `beer-bomb-background.png` or `beer-bomb-background.webp`
  - Portrait board/table backdrop
  - Preferred size: `1536x2732`
  - Keep important composition inside a centered `1179x2556` safe area
- `beer-idle.png`
  - Transparent unopened beer sprite
  - Preferred size: `256x256`
- `beer-drained.png`
  - Transparent safe reveal sprite after a beer is tapped
  - Preferred size: `256x256`
- `beer-bomb.png`
  - Transparent losing reveal sprite with bomb state
  - Preferred size: `256x256`

Optional source files:

- `beer-drain-1.png` through `beer-drain-4.png`
  - Extra animation frames
  - Preferred size: `256x256`
- `table-shadow.png`
  - Soft lineup shadow if not baked into the background
  - Preferred size: about `1400x320`
- `bomb-burst.png`
  - Extra reveal FX for the bomb hit state
  - Preferred size: `256x256` to `384x384`

Runtime assets should be copied or exported into:

- `public/mini-games/beer-bomb/`

The game supports a fallback mode if only these two files exist:

- `beer-bomb-background.*`
- `beer-idle.png`
