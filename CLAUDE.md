# TicketAll – Claude Code Instructions

## Project

Multi-tenant SaaS ticketing platform. Backend: NestJS 10 + Fastify 4 + Prisma 5 + PostgreSQL 16. Frontend: Next.js 14 App Router + Tailwind. Infra: Docker Compose at `/opt/maxiticket/infra/`, `.env` at `/opt/maxiticket/.env`.

## Doména a brand

| | |
|---|---|
| **Brand** | TicketAll (predtým Maxiticket – migrácia dokončená 2026-05-30) |
| **Domény** | `ticketall.eu` (apex + www) · `admin.ticketall.eu` · `api.ticketall.eu` · `skener.ticketall.eu` |
| **Prevádzkovateľ** | MaceT s.r.o. (IČO + sídlo TODO pre ostrú prevádzku) |
| **Live Stripe** | od 2026-05-30 |
| **Migračné commity** | `15d3965` storage · `496313f` caddy · `3a01aca` backend · `b6c0363` frontend · `992fa84` seed+homepage · `3af5f40` logo · `39f433f` toggle+nav |

---

## REGRESSION SAFETY RULES (pre každú úlohu)

1. Pri pridávaní novej funkčnosti SKONTROLUJ existujúce dotknuté kódové cesty pred zmenou. Ak meníš globálnu konfiguráciu (Fastify pluginy, middleware, content-type parsery, CORS, auth, body parsing, env loading), explicitne zváž, ktoré existujúce endpointy/featury môže ovplyvniť, a vymenuj ich v zhrnutí.

2. NEPREPISUJ existujúce volania/handlers bez overenia, že nová verzia robí presne to isté (alebo viac) ako stará. Pri refaktore dotknutej funkcie ukáž mi diff a počkaj na potvrdenie pred aplikáciou.

3. Po každej zmene infraštruktúry (Docker, Fastify pluginy, middleware) spusti regresný smoke-check kľúčových funkcionalít, ktoré existujú a SÚ DOTKNUTÉ:
   - Login (admin + customer): POST /v1/auth/login → 200 alebo zámerne 401.
   - Galéria: PATCH ../images/../cover → 200, POST ../images (multipart) → 201.
   - Reset hesla: POST /v1/auth/password/forgot → 200 a e-mail prejde Mailpit/SMTP.
   - Public listing: GET /v1/public/shows → 200 s coverUrl.
   - (Po Stripe:) checkout flow vytvorí session.
   Smoke-check rob z backend logov / curl-om, nie len z domnienky.

4. NEMEN HESLÁ existujúcich users v DB pri debugu. Ak treba otestovať auth, vytvor dočasného test usera a po teste ho zmaž.

5. Pri každej regresii najprv diagnostikuj REÁLNE z logov / odpovede / git diff, NEHÁDAJ. Ak môže byť príčin viac, vymenuj ich a navrhni overenie, pred aplikáciou opravy.

6. Pred git commit VŽDY over `git diff --stat --cached` – musí ukazovať skutočné súbory zodpovedajúce commit message. NIKDY necommituj iba commit message bez implementácie (incident acac2a6: commit s popisom 9 metrics endpointov obsahoval iba .gitignore – false success, ktorý mátol Geo a vyžadoval celú novú implementáciu).
