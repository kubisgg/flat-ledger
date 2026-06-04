# Flat Ledger

Prywatna aplikacja webowa do zarządzania miesięcznymi opłatami za mieszkanie.

## Stack

- Nuxt 4
- TypeScript
- SQLite
- Drizzle ORM
- Better Auth
- Docker Compose

## Lokalnie

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Przy pierwszym uruchomieniu aplikacja tworzy bazę SQLite, podstawowe typy opłat oraz konto admina z `ADMIN_EMAIL` i `ADMIN_PASSWORD`.

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Ustaw `NUXT_BETTER_AUTH_SECRET` na dlugi losowy sekret. Aplikacja jest przygotowana do pracy za reverse proxy albo w prywatnej sieci/Tailscale.
