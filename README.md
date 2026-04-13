# Feedback microservice

Express + TypeScript service for **user-generated content reports** and **in-app surveys**. It uses MongoDB, Logto JWT verification via `@tripsi-app/logto-server-auth`, and a config service for Logto public settings and feature flags.

Public HTTP routes on the API gateway use the **`/feedback`** prefix (see `gateway/vercel.json`).

## Prerequisites

- Node.js 20+ (recommended)
- MongoDB
- A running config service (see `CONFIG_SERVICE_BASE_URL`) and Logto tenant for production-like setups

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your MongoDB URI, config service URL, Logto values, and internal API key
```

## Scripts

| Command   | Description                          |
|----------|---------------------------------------|
| `npm run dev`   | Run with `nodemon` (TypeScript source) |
| `npm run build` | Compile to `dist/`                    |
| `npm start`     | Run compiled `dist/index.js`          |
| `npm run lint`  | ESLint on `.ts` files                 |

## HTTP routes

- `GET /health` — liveness check
- `GET /feedback/reports/eligibility`, `POST /feedback/reports` — content reports (Logto + feature flags)
- `GET /feedback/survey/active`, `POST /feedback/survey/:surveyId/responses` — in-app surveys (Logto + `feedback:surveys`)
- `GET /internal/feedback/reports`, `PATCH /internal/feedback/reports/:id` — content report moderation (`FEEDBACK_INTERNAL_API_KEY` or `REPORTS_INTERNAL_API_KEY`)
- `GET /internal/feedback/survey`, `POST /internal/feedback/survey`, `PATCH /internal/feedback/survey/:id`, `GET /internal/feedback/survey/:id/responses` — survey admin

## Environment variables

See `.env.example`. Use `FEEDBACK_INTERNAL_API_KEY` (or legacy `REPORTS_INTERNAL_API_KEY`) for internal routes.

## Publishing to GitHub

From this directory (it can be its own git repository):

```bash
git status
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-org>/<your-repo>.git
git push -u origin main
```

Ensure `.env` is never committed; it is listed in `.gitignore`.
