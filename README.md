# statpadscore

A daily leaderboard for [Statpad](https://statpadgame.com) — the sports trivia game. Upload your score screenshot, Claude reads it automatically, and your friends see where they stack up.

## Features

- **Leagues** — create a private group, share the invite link, done
- **Daily leaderboard** — scores grouped by sport (MLB, NFL, NBA, NHL), ranked by percentile
- **Screenshot parsing** — Claude Vision reads your score automatically, no manual entry
- **Date picker** — browse past days from a calendar, only days with scores are clickable
- **Click any score** — see the original screenshot
- **All-time stats** — per-sport rankings, avg percentile, streaks, purple-tile counter
- **League chat** — a running thread pinned to each league
- **Mobile friendly** — upload from camera roll, or drag & drop / Cmd+V on desktop
- **Admin panel** — `/admin` lists all leagues with invite links and lets you delete scores or whole leagues
- **Abuse-resistant** — IP rate limits on submit, league create, and chat; image type and size caps on uploads

## How it works

1. Create a league
2. Share the league link with your friends
3. Play [Statpad](https://statpadgame.com) and screenshot your results
4. Go to your league URL → **+ Submit** and upload the screenshot
5. Claude reads the score and updates the leaderboard

You can also see all-time stats, purple-tile hits, streaks, league chat, and more.

## Stack

- **Next.js 16** (App Router)
- **Vercel** for hosting (GitHub auto-deploy on push to `main`)
- **Upstash Redis** for score, league, and message storage
- **Vercel Blob** for screenshot storage
- **Claude claude-haiku-4-5** for parsing screenshots
- **@upstash/ratelimit** for per-IP throttling
- **Resend** for new-league admin notifications

## Setup

### Prerequisites

- Node.js 20+
- Vercel account
- Anthropic API key
- Upstash Redis database (via Vercel Marketplace)
- Vercel Blob store
- Resend account (optional — only needed for new-league notifications)

### Local development

```bash
npm install
```

Create `.env.local`:

```
# Required
ANTHROPIC_API_KEY=your_key_here
KV_REST_API_URL=your_upstash_url
KV_REST_API_TOKEN=your_upstash_token
BLOB_READ_WRITE_TOKEN=your_blob_token

# Required for /admin
ADMIN_PASSWORD=your_admin_password

# Optional — enables admin email on new league
RESEND_API_KEY=re_your_key_here
NOTIFY_EMAIL=your@email.com
```

```bash
npm run dev
```

### Deploy

Pushing to `main` deploys to production automatically via the Vercel GitHub
integration. No CLI step required.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page — create or join a league |
| `/[leagueId]` | League leaderboard |
| `/[leagueId]/submit` | Submit a score |
| `/admin` | Admin panel (password protected) |
