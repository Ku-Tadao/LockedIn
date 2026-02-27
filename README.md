# LockedIn

A Deadlock data hub — explore heroes, abilities, analytics, and leaderboards. Built with [Astro](https://astro.build) and powered by the [Deadlock API](https://deadlock-api.com).

## Features

- **Hero Database** — Browse all Deadlock heroes grouped by type (Brawler, Marksman, Mystic, Assassin) with detailed stats, abilities, and complexity ratings
- **Hero Stats** — Win rates, pick rates, and performance data filtered by rank
- **Leaderboard** — Top players across all regions (Europe, N. America, S. America, Asia, Oceania)
- **Player Search** — Look up any player via Steam username to see match history and hero usage
- **Dark/Light Theme** — Toggle between themes with persistent preference
- **Static Site** — Pre-rendered at build time for fast loading, client-side interactivity for live data

## Tech Stack

- **Astro 5** — Static site generator
- **TypeScript** — Type-safe data fetching
- **Deadlock API** — Hero data, analytics, leaderboards, player search
- **Vanilla JS** — Client-side interactivity (no framework overhead)
- **CSS Custom Properties** — Full design system with light/dark themes

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── Overview.astro      # Landing splash with hero strip & quick links
│   ├── Heroes.astro        # Hero roster grouped by type
│   ├── Stats.astro         # Hero analytics table
│   └── Leaderboard.astro   # Regional leaderboard
├── layouts/
│   └── Layout.astro        # HTML shell, header, nav, modals, footer
├── lib/
│   ├── api.ts              # Data fetching from Deadlock API
│   ├── icons.ts            # SVG icon definitions
│   └── types.ts            # TypeScript interfaces
├── pages/
│   └── index.astro         # Single page entry point
├── scripts/
│   └── app.js              # Client-side interactivity
└── styles/
    └── global.css           # Design system & all component styles
```

## API Attribution

All game data provided by the [Deadlock API](https://deadlock-api.com). This project is not affiliated with Valve.

## License

MIT
