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
├── frontend/          # Next.js 14 App Router (single app, host-based routing)
│   ├── src/
│   │   ├── middleware.ts       # reads Host → sets x-area header (public/admin/scanner)
│   │   ├── app/
│   │   │   ├── layout.tsx      # root layout + globals.css (Tailwind)
│   │   │   ├── page.tsx        # root "/" – area-aware redirect / public homepage
│   │   │   ├── (public)/       # maxiticket.africa / www – event pages, checkout
│   │   │   ├── (admin)/        # admin.maxiticket.africa – login, register, dashboard
│   │   │   │   ├── login/
│   │   │   │   ├── register/   # self-reg with acceptTerms
│   │   │   │   └── dashboard/  # role-aware placeholder
│   │   │   ├── (scanner)/      # skener.maxiticket.africa – PWA scanner
│   │   │   │   └── scan/
│   │   │   └── api/auth/       # route handlers: login, register, refresh, logout
│   │   ├── lib/
│   │   │   ├── api.ts          # typed fetch wrapper + authApi helpers
│   │   │   └── auth.ts         # access token in memory, refresh via /api/auth/refresh
│   │   └── components/
│   │       ├── ui/             # Button, Input
│   │       └── auth/           # LoginForm, RegisterForm
│   └── public/
│       ├── manifest.json       # PWA manifest (scanner)
│       ├── sw.js               # Service worker (scanner – cache-first)
│       └── icons/              # PWA icons
└── infra/
    ├── docker-compose.yml
    ├── caddy/Caddyfile
    ├── postgres/
    │   ├── init.sql
    │   └── backup.sh  # run via cron, 14-day retention
    └── .env.example
```

## Auth & RBAC

### JWT tokens
- **Access token**: 15 min TTL, signed with `JWT_SECRET`, carries `{ sub, email, role, organizerId? }`.
- **Refresh token**: 7-day TTL, random UUID stored in `RefreshToken` table, rotated on every use (old token marked `revokedAt`).
- Endpoints: `POST /v1/auth/register`, `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`.

### Self-registration flow
`POST /v1/auth/register` requires `acceptTerms: true`. On success, a transaction creates:
1. `Organizer` (status `PENDING` until approved by STAFF/SUPERADMIN)
2. `User` with role `ORGANIZER_OWNER` linked to the new organizer
3. `TermsAcceptance` for the current active `ORGANIZER_REGISTRATION` terms version

### Role model

| Role | Scope | Capabilities |
|---|---|---|
| `SUPERADMIN` | Platform | Full access to everything |
| `STAFF` | Platform | Create/manage shows for clients, support; no billing changes |
| `ORGANIZER_OWNER` | Tenant | Full control: org profile, shows, tickets, images, template, stats, own staff |
| `ORGANIZER_MEMBER` | Tenant | Manage shows/termins/tickettypes, read orders/scans |
| `SCANNER` | Tenant | Scan tickets only |
| `CUSTOMER` | Public | Own orders and tickets |

Platform roles (`SUPERADMIN`, `STAFF`) have `organizerId = null`.  
Tenant roles (`ORGANIZER_OWNER`, `ORGANIZER_MEMBER`, `SCANNER`) require non-null `organizerId`.

### CASL ability-based authorization
`CaslAbilityFactory` builds a `MongoAbility` for each request from the JWT payload.  
Use `@CheckPolicies(ability => ability.can('update', 'Show'))` on handlers, backed by `PoliciesGuard`.  
Coarse role checks use `@Roles(...)` + `RolesGuard`.

### Tenant isolation
- Every tenant-owned model carries `organizerId` (FK to `Organizer`).
- NestJS services filter all queries by `organizerId` extracted from the JWT.
- `SUPERADMIN`/`STAFF` bypass the tenant filter.
- PostgreSQL Row-Level Security is **not** enabled in v1 (application-layer isolation is sufficient); can be added as a hardening step later.

### Ticket template
`Organizer.ticketTemplate` and `Show.ticketTemplate` hold arbitrary JSON for the ticket PDF/display layout. Show-level value overrides the organizer default. A visual editor is planned for a later milestone.

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

## Frontend routing strategy

One Next.js app serves all three subdomains. `src/middleware.ts` reads the `Host` header and writes `x-area: public|admin|scanner` into request headers. Pages read this via `headers()` (Server Components) to conditionally redirect or render different content.

**Token security model:**
- Access token: stored in React module-level memory only (never localStorage). Lost on page refresh → automatically refreshed via `/api/auth/refresh`.
- Refresh token: stored in `httpOnly; Secure; SameSite=Strict` cookie under the `/api/auth` path, managed by Next.js route handlers. Never exposed to client JS.
- `/api/auth/refresh` rotates the refresh token on every call (single-use tokens).

**PWA (skener.maxiticket.africa):**
- `public/manifest.json` declares standalone display mode, start_url `/scan`.
- `public/sw.js` cache-first service worker for offline support.
- Camera scanning deferred to next milestone.

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

## Domain setup

DNS is live: `maxiticket.africa` + wildcard `*.maxiticket.africa` → this server.

| Subdomain | Routes to | Purpose |
|---|---|---|
| `api.maxiticket.africa` | `backend:3001` | REST API |
| `maxiticket.africa`, `www` | `frontend:3000` | Public event pages + checkout |
| `admin.maxiticket.africa` | `frontend:3000` | Organizer + superadmin portal |
| `skener.maxiticket.africa` | `frontend:3000` | Scanner PWA |

ACME email: `info@maxiticket.sk`. TLS issued automatically by Caddy on first request.

## Backup

Daily cron via `infra/postgres/backup.sh`:  
- `pg_dump` → gzip → `/opt/maxiticket/backups/postgres/`  
- 14-day retention  
- Cron line: `0 3 * * * /opt/maxiticket/infra/postgres/backup.sh`

Off-site replication (e.g. Hetzner Storage Box / S3) is a **recommended next step**.
