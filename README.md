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
- Optional MCP server with token management in settings

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
| `AUTH_SECRET` | Random secret for Better Auth and MCP token encryption; MCP requires at least 32 characters |
| `AUTH_URL` | App URL used for auth redirects, the displayed MCP endpoint, and MCP Host/Origin validation |
| `DEV_SERVER_ALLOWED_HOSTS` | Optional comma-separated hostnames allowed to access the local dev server |
| `ADMIN_EMAIL` | Initial admin account email |
| `ADMIN_PASSWORD` | Initial admin account password |
| `ADMIN_NAME` | Initial admin account name |

## MCP

MCP is disabled by default. The panel lets you show or copy the token and the endpoint URL, enable/disable the server and reset the token.

Connect a client that supports Streamable HTTP:

```text
URL: <AUTH_URL>/mcp
Authorization: Bearer <token from settings>
```

The endpoint uses the official MCP TypeScript SDK v2, supports the `2026-07-28` protocol, and serves earlier Streamable HTTP clients.

Available tools are read-only:

| Tool | Arguments | Result |
|---|---|---|
| `get_latest_month_summary` | None | Latest month, full and rounded transfer amount, transfer sent flag |
| `list_months` | Optional `page` and `itemsPerPage`, maximum 100 per page | Months, newest first, and total count |
| `get_month_details` | `monthId` | Month, charges, charge categories and meter readings |
| `get_meter_history` | None | Up to 12 recorded months of usage per meter type, numeric usage delta and percentage change |

The tools share query and calculation functions with the application API.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```