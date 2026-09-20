# Celestial Companions Portal

A small private website for sharing a project with one client: the plan, a running list of progress, a live demo, weekly reports, open decisions, and the questions that need the client's answers. Everything sits behind a sign-in.

It is built for one owner (who runs it) and one client (who reads and answers), with read-only viewers if needed.

## What it does

- **Sign-in only.** Email and password. Sign-ups are switched off, so only people the owner creates can get in. A signed-in person who has not been added sees a "No access yet" screen.
- **Overview.** The Blueprint pinned at the top, then what is waiting for the reader (the owner sees what is waiting on the client), the live demo, the latest update and the latest weekly report.
- **Blueprint.** A long document written in Markdown, with contents links, diagrams and a schedule chart, then its questions, then a comments box.
- **Questions and answers.** The client types an answer, and the box is replaced by the saved text. The pen (or a double-click) edits it, Esc cancels, Ctrl+Enter saves, and it shows when it was last edited. The owner replies underneath. A closed question takes no new answers, and can show a note (an answer that arrived by email).
- **Progress.** A link to the live demo, optionally previewed on the page, and a log with one entry for each finished major update.
- **Weekly reports.** A list and a page for each. Drafts can only be seen by the owner.
- **Decisions.** Open, decided and parked.
- **Manage (owner only).** Edit updates, weekly reports, questions, decisions and the demo details in the browser. It can draft this week's report from the week's activity, and copy it as an email.
- **Account.** Change password, sign out.
- **Theme.** Follows the system setting, with a manual toggle that is not remembered.

## How it keeps things private

The content is not in the website's files. It lives in a database (Supabase Postgres) behind Row-Level Security, and the site is an empty shell that fetches what the signed-in person is allowed to see.

- Nothing can be read without a sign-in and a row in the profiles table.
- Drafts are readable by the owner only.
- Messages (answers, comments and replies) are linked to exactly one thing each, can be edited only by their author and only in their text, and can never be deleted.
- Only the public "publishable" key is used in the browser. No secret or service-role key is ever used or needed.

## The message model

One table holds every kind of message. An **answer** is linked to a question, a **comment** to a document, and a **reply** to another message. Exactly one link per message. Each person can give one answer per question. An edit changes only the text and stamps the edited time.

## Stack

React, TypeScript and Vite. React Router. Supabase (Auth and Postgres). Markdown with `marked`, cleaned by DOMPurify. Diagrams with Mermaid. Tests with PGlite (Postgres running in Node) and Playwright.

## Running it

```
npm install
npm run dev:demo      # sample data and a stand-in database, no setup needed
```

Open the address it prints. In demo mode, sign in as `owner@example.com`, `client@example.com` or `viewer@example.com`, with the password `demo`. `nobody@example.com` signs in but has no access, to show that screen.

To run it against a real database, follow [SETUP.md](SETUP.md), which walks through every step.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the site against the real database (needs `.env.local`). |
| `npm run dev:demo` | Runs the site with sample data and no database. |
| `npm run build` | Type-checks and builds the site into `dist/`. |
| `npm run seed` | Regenerates `supabase/seed.sql` from the Markdown in `content/`. |
| `npm run test:db` | Tests the database access rules on a local Postgres. |
| `npm run test:e2e` | Runs the browser tests (uses the installed Microsoft Edge). |
| `npm run check:build` | Proves the production build contains no demo code and no page content. |
| `npm run lint` | Lints the code. |

## Where things are

```
content/     The starting text (Markdown) and the starting lists (seed.json).
supabase/    schema.sql, seed.sql (generated), members.sql (template), and the tests.
src/         The site.
src/demo/    The demo stand-in. It is not included in a normal build.
tests/       Browser tests.
scripts/     The seed generator and the build check.
```

## Demo code stays out of the real site

Demo mode is switched on only by `VITE_DEMO=1`. In a normal build that branch is removed, so the stand-in database and its sample data are not shipped. `npm run check:build` builds both ways and checks this.

## Licence

Copyright (c) 2026 Ivhel. All rights reserved. The code is published to be read. See [LICENSE](LICENSE): copying, modifying and using it are not permitted.
