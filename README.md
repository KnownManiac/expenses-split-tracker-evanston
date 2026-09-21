# Household Expense Tracker

A shared expense tracker for two people (G and B): log expenses manually or by chatting/talking to an AI assistant, split costs equally/by percentage/manually, see a running balance, and export a PDF report.

## Stack

- Next.js 14 (App Router, TypeScript) — deploys to Vercel with no extra config
- Vercel Postgres — stores expenses
- Anthropic Claude (`claude-haiku-4-5`) with tool use — parses chat/voice messages into actions
- Browser Web Speech API — free voice-to-text for the mic button (no audio upload/transcription cost)
- `pdf-lib` — generates the PDF report
- PIN-gated session cookie (`jose`) — no user accounts, just a shared PIN + G/B picker

## Local development

1. `npm install`
2. Create a Postgres database and copy `.env.example` to `.env.local`, filling in:
   - `APP_PIN` — the login PIN
   - `AUTH_SECRET` — random string, e.g. `openssl rand -base64 32`
   - `ANTHROPIC_API_KEY` — from https://console.anthropic.com/settings/keys
   - `POSTGRES_URL` — your Postgres connection string
3. `npm run dev` and open http://localhost:3000

The expenses table is created automatically on first use — no manual migration step.

## Deploying to Vercel

1. Push this repo to GitHub (or run `vercel` from this directory) and import it into Vercel.
2. In the Vercel project, go to **Storage → Create Database → Postgres** and connect it to the project. This sets `POSTGRES_URL` automatically.
3. In **Settings → Environment Variables**, add:
   - `APP_PIN`
   - `AUTH_SECRET`
   - `ANTHROPIC_API_KEY`
4. Deploy. That's it — no other infrastructure is required.

## Notes

- Voice input relies on the browser's built-in `SpeechRecognition` API, which currently works in Chrome/Edge. In unsupported browsers the mic button is disabled and typing still works.
- The chat assistant can add, edit, delete, and list expenses, report the balance, and generate the PDF — all through the same tool-use loop, so typed and spoken messages behave identically.
