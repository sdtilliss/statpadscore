# statpadscore

A daily leaderboard for [Statpad](https://statpadgame.com) — the sports trivia game. Upload your score screenshot, Claude reads it automatically, and your friends see where they stack up.

## Features

- **Leagues** — create a private group, share the invite link, done
- **Daily leaderboard** — scores grouped by sport (MLB, NFL, NBA, NHL), ranked by percentile
- **Screenshot parsing** — Claude Vision reads your score automatically, no manual entry
- **Click any score** — see the original screenshot
- **All-time stats** — per-sport rankings, avg percentile, streaks
- **Mobile friendly** — upload from camera roll, or drag & drop / Cmd+V on desktop
- **Admin panel** — `/admin` lists all leagues with invite links

## How it works

1. Play Statpad, screenshot your results
2. Go to your league URL → **+ Submit**
3. Enter your name, upload the screenshot
4. Claude reads the score, saves it, done

## Stack

- **Next.js** (App Router)
- **Vercel** for hosting
- **Upstash Redis** for score storage
- **Vercel Blob** for screenshot storage
- **Claude claude-haiku-4-5** for parsing screenshots

## Setup

### Prerequisites

- Node.js 20+
- Vercel account
- Anthropic API key
- Upstash Redis database (via Vercel Marketplace)
- Vercel Blob store

### Local development

```bash
npm install
```

Create `.env.local`:

```
ANTHROPIC_API_KEY=your_key_here
KV_REST_API_URL=your_upstash_url
KV_REST_API_TOKEN=your_upstash_token
BLOB_READ_WRITE_TOKEN=your_blob_token
```

```bash
npm run dev
```

### Deploy

```bash
npx vercel --prod
```

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page — create or join a league |
| `/[leagueId]` | League leaderboard |
| `/[leagueId]/submit` | Submit a score |
| `/admin` | Admin panel (password protected) |
