# Flat Ledger

A personal dashboard for managing my flat payments.

## Why?

Tracking monthly rent and bills in Google Sheets got annoying - updating it each month felt like a chore. So I built a small self-hosted app instead, running on my home server, that does exactly what I need.

## Features

- Dashboard with current month summary and payment status
- Configurable payment types - fixed, metered (electricity, water etc.), or manual
- Meter usage history chart (last 12 months)
- Bank transfer title generator
- Single-user, auth-protected

## Stack

- [Nuxt 4](https://nuxt.com) + TypeScript
- SQLite + [Drizzle ORM](https://orm.drizzle.team)
- [Better Auth](https://www.better-auth.com)
- [Nuxt UI](https://ui.nuxt.com) + Tailwind CSS
- [ApexCharts](https://apexcharts.com)
- Docker Compose

## Running locally

```bash
pnpm install
cp .env.example .env
pnpm dev
```

On first run the app creates an SQLite database, seeds default payment types, and creates an admin account using `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` from `.env`.

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Not intended to be exposed to the public internet - runs on a home server in a local network.

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite file path - dev only |
| `AUTH_SECRET` | Random secret for Better Auth |
| `AUTH_URL` | App URL used for auth redirects |
| `ADMIN_EMAIL` | Initial admin account email |
| `ADMIN_PASSWORD` | Initial admin account password |
| `ADMIN_NAME` | Initial admin account name |
