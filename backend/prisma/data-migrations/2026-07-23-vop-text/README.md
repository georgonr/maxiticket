# VOP text vložený do TermsVersion (krok 43)

Dva samostatné dokumenty (variant B), platformové (organizerId NULL), version 1.0,
publishedAt 2026-01-01, isActive true:

- `vop-kupujuci.md`      → TermsVersion type = BUYER_PURCHASE
- `vop-organizatori.md`  → TermsVersion type = ORGANIZER_REGISTRATION

Vložené na produkciu skriptom `apply.sql` (psql \set z .md súborov, bez shell
interpolácie – bezpečné voči apostrofom/$/backtickom). apply.sql je idempotentný:
INSERT ak riadok chýba + UPDATE content. Znenie sa zobrazuje na /obchodne-podmienky
a auth.service zaň zaznamenáva TermsAcceptance pri registrácii.
