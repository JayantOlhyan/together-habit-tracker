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

### Sign-in

The owner chose each person's name as their password. Matching is case-insensitive:

| Profile | Password |
| --- | --- |
| Jayant | jayant |
| Babita | babita |
| Naveen | naveen |

These passwords are easy to guess and offer minimal privacy. Anyone who knows the names can sign in to those profiles. They should not be treated as secure protection for sensitive records.

No password environment variables are required. A random 256-bit session signing key is automatically created in the private site-wide Blobs store with an atomic create-if-new write. Both API functions read the same key; it survives deploys and never enters the browser or GitHub. An optional `SESSION_SECRET` environment variable (at least 32 characters) overrides that key. Changing it invalidates existing sessions.

Sessions last seven days. The server compares name passwords case-insensitively using constant-time digest comparison. The old `JAYANT_PASSWORD`, `BABITA_PASSWORD`, and `NAVEEN_PASSWORD` variables are no longer used.

## Local development

```sh
npm install
npm test
npm run build
npm run dev
```

Open `http://localhost:4173`. The local QA server uses memory, not the production store, and generates a temporary random session signing key. Use the profile names to sign in. It does not load `.env` automatically. The device preview requires no credentials. For the deployed Functions/Blobs runtime use Netlify CLI's official local development workflow.

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
