# Maxiticket – Architecture Overview

## System overview

Multi-tenant SaaS ticketing platform. Three actor types:
- **Superadmin** – platform operators (us)
- **Organizer** – self-registered tenants who create events and sell tickets
- **Buyer** – end customers who purchase tickets

## Tech stack

| Layer | Technology | Rationale |
|---|---|---|
| Database | PostgreSQL 16 | ACID, JSON support, row-level security ready, full-text search via `pg_trgm` |
| ORM | Prisma 5 | Type-safe queries, migration tooling, readable schema |
| Backend | NestJS 10 + Fastify + TypeScript | Module system maps cleanly to domain boundaries; Fastify outperforms Express |
| Frontend | Next.js 14 (App Router) + TypeScript | SSR for SEO on public event pages; RSC for dashboards |
| Styling | Tailwind CSS + Radix UI | Utility-first, accessible primitives |
| Cache / Sessions | Redis 7 | JWT refresh token store, rate limiting, BullMQ job queue |
| Reverse proxy | Caddy 2 | Automatic Let's Encrypt, zero-config HTTPS; swap domains in Caddyfile |
| Containerisation | Docker Compose | Single-node for now; Compose file is Swarm/K8s-portable |
| Auth | JWT (access 15m) + refresh (7d, Redis-stored) | Stateless API, revocable sessions |

## Repository structure

```
/opt/maxiticket/
├── backend/           # NestJS app
│   ├── prisma/        # schema.prisma + migrations
│   └── src/
│       ├── auth/
│       ├── organizers/
│       ├── shows/
│       ├── termins/
│       ├── tickets/
│       ├── orders/
│       ├── scanner/
│       └── admin/
├── frontend/          # Next.js app
│   └── src/app/
│       ├── (public)/  # event pages, checkout
│       ├── (organizer)/ # organizer dashboard
│       ├── (admin)/   # superadmin dashboard
│       └── scanner/   # PWA scanner
└── infra/
    ├── docker-compose.yml
    ├── caddy/Caddyfile
    ├── postgres/
    │   ├── init.sql
    │   └── backup.sh  # run via cron, 14-day retention
    └── .env.example
```

## Multi-tenant isolation strategy

- Every tenant-owned model carries `organizerId` (FK to `Organizer`).
- NestJS guards inject `organizerId` from the JWT on every authenticated request and filter all queries by it.
- Superadmin bypass: `SUPERADMIN` role skips the tenant filter.
- PostgreSQL Row-Level Security is **not** enabled in v1 (application-layer isolation is sufficient and simpler to reason about); can be added as a hardening step later.

## Data model key decisions

### Show vs Termin split
A **Show** holds metadata (name, description, poster, SEO) that is stable across dates.  
A **Termin** holds the specific date, venue, and ticket types for one occurrence.  
Rationale: recurring events (concerts, theatre) reuse show content without duplicating it.

### Ticket QR token
`qrToken` = `HMAC-SHA256(secret, ticketId:terminId:nonce)` encoded as base64url.  
- Signed server-side at order completion.
- Scanner verifies signature offline (HMAC key cached in PWA service worker).
- `ScanLog` records every scan attempt; second scan of the same ticket returns `ALREADY_USED`.
- `nonce` stored in DB — if ticket is refunded, nonce is rotated so old printed QRs become invalid.

### Anti-passback
Enforced via `Ticket.status = USED` + `Ticket.usedAt` set atomically on first valid scan.  
`ScanLog` keeps full audit trail (device ID, IP, timestamp, result).

### Multi-currency
`TicketType.currency` is ISO 4217 (EUR default). Each order records its own currency.  
Platform reports in EUR using fixed exchange rates stored separately (not in v1 schema).

### Orders
`OrderItem.priceSnapshot` (JSON) captures price at purchase time so historical reporting is immune to price changes.  
`Order.orderNumber` is human-readable (`MT-YYYY-NNNNN`) for support lookups.

### Terms & Conditions
`TermsVersion` is versioned; `isActive = true` marks the current version.  
Acceptance is recorded with IP + user-agent for legal compliance.

## Networking (Docker Compose)

```
Internet → Caddy :80/:443
              ├── api.DOMAIN → backend:3001
              └── app.DOMAIN → frontend:3000
                                    ↓
                              internal Docker network
                              ├── postgres:5432
                              └── redis:6379
```

Backend and postgres/redis are **not exposed** to the host — only Caddy has external ports.

## Security hardening (server level)

- Non-root `deploy` user with SSH key auth; root SSH login disabled.
- `PasswordAuthentication no` in sshd.
- `fail2ban` bans IPs after 5 failed SSH attempts (24h ban).
- `unattended-upgrades` for automatic security patches.
- UFW: only ports 22, 80, 443 open.

## Domain setup (TODO)

Edit `infra/caddy/Caddyfile` – replace `api.example.com` / `app.example.com` with real domains.  
Point DNS A records to this server's IP. Caddy handles TLS automatically on first request.

## Backup

Daily cron via `infra/postgres/backup.sh`:  
- `pg_dump` → gzip → `/opt/maxiticket/backups/postgres/`  
- 14-day retention  
- Cron line: `0 3 * * * /opt/maxiticket/infra/postgres/backup.sh`

Off-site replication (e.g. Hetzner Storage Box / S3) is a **recommended next step**.
