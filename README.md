# Together

A private habit tracker for **Jayant, Babita, and Naveen**, with a responsive, WholeMark-inspired interface. Works in iPhone Safari and Android Chrome, and can be added to the home screen.

## Features

- Three authenticated profiles; all members can view the circle, each edits only their own records.
- Custom habits, units, daily targets, quick-log quantities, and notes.
- Build, limit, and observation modes. An unlogged day never counts as a successful zero day.
- Optional templates for exercise, water, walking, reading, meditation, sleep, smoking, alcohol, and mood.
- Date navigation, past-date logging, 7/30-day summaries, month history, undo/restore, archive/restore, JSON and CSV exports.
- One shared, persistent Netlify Blobs store. Conditional writes prevent concurrent saves from overwriting one another. Entry IDs make retries idempotent.
- Secure HttpOnly session cookies, same-origin mutation checks, function rate limits, server-side validation, and a restrictive content security policy.
- Explicit device-only preview, separate from production data. Preview data lives in tab session storage and is never uploaded.

## Deploy on Netlify

Import this GitHub repository into Netlify. `netlify.toml` supplies the test/build command, output folder, and function directory. Node 22 is configured. Netlify automatically provisions access to the site-wide `together-family` Blobs store on the first real write; it persists across deploys. Do not replace it with a deploy-specific store.

### Required private access setup

In **Project configuration → Environment variables**, add these **three different passphrases**, each at least 12 characters long:

| Variable | Person |
| --- | --- |
| `JAYANT_PASSWORD` | Jayant |
| `BABITA_PASSWORD` | Babita |
| `NAVEEN_PASSWORD` | Naveen |

Make them available to **Functions** in **Production**. For accounts without scope controls, the default runtime scopes are sufficient. Do not enable these secrets for untrusted deploy previews. Trigger a new production deployment after setting or changing them. Optionally add a random `SESSION_SECRET`; otherwise the signing key derives from all three passphrases. Changing the signing material invalidates existing sessions. Give each person only their own passphrase. Never commit credentials or real habit records to GitHub.

Until configured, the app locks the shared API and shows setup guidance. The UI remains previewable using “Try a device-only preview.” There is deliberately no public first-visitor setup endpoint and no default password.

Sessions last seven days. Server-side passphrase verification uses constant-time digest comparison. This small private-circle authentication has no automated password recovery; the Netlify account owner rotates passphrases in environment variables. Signing and data access remain on the server.

## Local development

```sh
npm install
npm test
npm run build
npm run dev
```

Open `http://localhost:4173`. The local QA server uses memory, not the production store, and starts with private access locked unless the three passphrases are supplied as process environment variables. It does not load `.env` automatically. The device preview requires no credentials. For the deployed Functions/Blobs runtime use Netlify CLI's official local development workflow.

## Behaviour and limits

- Dates are recorded in Asia/Kolkata. Entries are additive, with quantities up to 1,000,000 and two decimal places.
- Limit goals are self-chosen tracking values, not medical recommendations. Zero requires an explicit check-in.
- Defaults are water, exercise, and reading for each person, with empty history. Smoking and alcohol are optional templates, not assumed behaviour.
- A week summary uses the current active habits. Archiving a habit changes the current daily goal denominator; retained history remains available. Goal definitions are fixed per habit. Archive and create a new habit when changing a target so old records retain their meaning.
- The client refreshes the shared view every 30 seconds while visible, and when reopening the page. No offline queue: an entry is confirmed only after a successful server response. Failed writes can be retried; check History if a network failure occurred after submission.
- Public shell files may be cached by the service worker; authenticated API responses are not cached. Signing out clears the in-memory shared view.
- 60 active habits per person; 50,000 lifetime log entries per store. Full-state compare-and-swap storage is appropriate for this three-person app, not a large public service. Keep periodic exports.
- Netlify usage is subject to the account's plan and credits. This repository does not create a paid subscription.

## Tests

`npm test` covers authentication, secure sessions, missing setup, read/write permissions, concurrent updates, idempotent replay, undo/restore, date and quantity validation, cross-origin rejection, zero-day semantics, and archiving.

## Source layout

`public/` is the buildless frontend; `lib/` contains the shared model and server logic; `netlify/functions/` wraps the API and Netlify Blobs adapter; `scripts/` builds and runs the local QA server; `test/` contains Node tests. `npm run build` copies frontend assets and the shared model into `dist/`.
