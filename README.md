# Feedback microservice

Express + TypeScript service for **user-generated content reports**, **in-app surveys**, **announcements** and **campaign promotions** (delivery to the app and their admin management). It uses MongoDB, Logto JWT verification via `@tripsi-app/logto-server-auth`, and a config service for Logto public settings and feature flags.

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
- `GET /feedback/announcements/active`, `/feedback/campaign-delivery/*` — announcements and campaign promotions shown in the app
- `/feedback/internal/reports`, `/feedback/internal/survey`, `/feedback/internal/announcements`, `/feedback/internal/campaign-delivery` — admin management (`FEEDBACK_INTERNAL_API_KEY`, or the legacy `REPORTS_INTERNAL_API_KEY`)

Route files: `src/routes/`. Product analytics no longer goes here; it goes to OpenPanel
([`docs/product/analytics-events.md`](../../docs/product/analytics-events.md)).

## Environment variables

See `.env.example`. Use `FEEDBACK_INTERNAL_API_KEY` (or legacy `REPORTS_INTERNAL_API_KEY`) for internal routes.
