# Agent Guard

Agent Guard is a local/self-hosted app for observability, API key management, and project operations.

## Prerequisites

- Node.js `24`
- `pnpm` `10+`
- Docker Desktop (for local infra)

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment:

- Copy `.env.dev.example` to `.env` (if not already present).
- Ensure these values are set in `.env`:
  - `NEXTAUTH_URL="http://localhost:3001"`
  - `PORT=3001`
  - local init user/org/project values (`LANGFUSE_INIT_*`)

3. Start infra services:

```bash
pnpm run infra:dev:up
```

4. Run app:

```bash
pnpm run dev
```

5. Open:

- `http://localhost:3001`

## Useful Commands

```bash
pnpm run dev:web        # run web only
pnpm run dev:worker     # run worker only
pnpm run infra:dev:down # stop infra
pnpm run infra:dev:prune # stop + remove volumes
pnpm run dx             # full local reset + run
```

## Default Local Login

If `LANGFUSE_INIT_USER_*` is configured in `.env`, local bootstrap user is created automatically.

Example:

- Email: `admin@agentguard.local`
- Password: `AgentGuard@1234`

## Troubleshooting

- Stuck on sign-in redirect:
  - Verify web app is running on `3001`.
  - Verify `.env` has correct `NEXTAUTH_URL` and DB connectivity.
- API key delete shows internal error:
  - Restart `dev` server after pulling latest changes.
  - Re-check Redis and database connectivity.

