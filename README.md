# Household Expense Tracker

A shared expense tracker for two people (G and B): log expenses manually or by chatting/talking to an AI assistant, split costs equally/by percentage/manually, see a running balance, and export a PDF report.

## Stack

- Next.js 15 (App Router, TypeScript) — deploys to Vercel with no extra config
- Postgres (via `pg`) — works with Vercel's Neon-backed Postgres storage or any Postgres instance
- Anthropic Claude (`claude-haiku-4-5`) with tool use — parses chat/voice messages into actions
- Browser Web Speech API — free voice-to-text for the mic button (no audio upload/transcription cost)
- `pdf-lib` — generates the PDF report
- `nodemailer` over Gmail SMTP + Vercel Cron — sends a weekly balance summary email every Saturday
- PIN-gated session cookie (`jose`) — no user accounts, just a shared PIN + G/B picker

## Local development

1. `npm install`
2. Create a Postgres database and copy `.env.example` to `.env.local`, filling in:
   - `APP_PIN` — the login PIN
   - `AUTH_SECRET` — random string, e.g. `openssl rand -base64 32`
   - `ANTHROPIC_API_KEY` — from https://console.anthropic.com/settings/keys
   - `POSTGRES_URL` — your Postgres connection string
   - `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `EMAIL_G` / `EMAIL_B` / `CRON_SECRET` — see "Weekly email summary" below
3. `npm run dev` and open http://localhost:3000

The expenses table is created automatically on first use — no manual migration step.

## Deploying to Vercel

1. Push this repo to GitHub (or run `vercel` from this directory) and import it into Vercel.
2. In the Vercel project, go to **Storage → Create Database**, choose **Neon (Postgres)**, and connect it to the project — leave the "Custom Prefix" field blank. This sets `POSTGRES_URL` automatically.
3. In **Settings → Environment Variables**, add:
   - `APP_PIN`
   - `AUTH_SECRET`
   - `ANTHROPIC_API_KEY`
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_G`, `EMAIL_B`, `CRON_SECRET` (for the weekly email — see below)
4. Deploy. `vercel.json` already defines the weekly cron job, so it's picked up automatically — nothing to configure in the dashboard.

## Weekly email summary

Every Saturday, `/api/cron/weekly-summary` runs (via the cron schedule in `vercel.json`) and emails both `EMAIL_G` and `EMAIL_B` a summary of who owes whom and the past week's expenses, sent from a Gmail account using an App Password (free, no domain needed).

Setup:

1. Pick which Gmail account should send the email (e.g. `girinath19@gmail.com`) and turn on **2-Step Verification** on it: https://myaccount.google.com/security
2. Generate an App Password: https://myaccount.google.com/apppasswords → app "Mail" → copy the 16-character password.
3. Set env vars:
   - `GMAIL_USER` = that Gmail address
   - `GMAIL_APP_PASSWORD` = the 16-character app password (no spaces)
   - `EMAIL_G` = `girinath19@gmail.com`
   - `EMAIL_B` = `bhaskar.ssamineni@gmail.com`
   - `CRON_SECRET` = a random string (`openssl rand -base64 32`) — Vercel automatically sends this as a bearer token when it triggers the cron job, and the route checks it, so no one else can trigger the email.

The schedule (`0 14 * * 6` in `vercel.json`) runs Saturdays at 14:00 UTC, i.e. ~9am Central time (shifts by an hour with daylight saving). Edit that cron string directly if you want a different day/time.

To test it manually before waiting for Saturday:
```
curl -H "Authorization: Bearer <your CRON_SECRET>" https://<your-app>.vercel.app/api/cron/weekly-summary
```

## Notes

- Voice input relies on the browser's built-in `SpeechRecognition` API, which currently works in Chrome/Edge. In unsupported browsers the mic button is disabled and typing still works.
- The chat assistant can add, edit, delete, and list expenses, report the balance, and generate the PDF — all through the same tool-use loop, so typed and spoken messages behave identically.
- Vercel's Hobby plan supports cron jobs at up to once-a-day frequency, so the weekly schedule here is well within limits.
